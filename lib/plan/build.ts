import type { FieldStatus } from "@/lib/db/vocab";
import { closingLabel } from "@/lib/format/display";
import { daysUntilDeadline, parseClosingText } from "@/lib/recommendation/deadline";
import { FIELD_SPECS, SCALAR_FIELD_KEYS, type TenderFieldKey } from "@/lib/tenders/field-catalog";

/**
 * The preparation plan for one tender. Built only from extracted fields and the
 * readiness result. No model call.
 */

export type PlanSection = "documents" | "questions" | "outline" | "dates";
export type ActionKind = "document" | "question" | "outline" | "date";

export interface PlanRequirement {
  text: string;
  pageNo: number | null;
  match: "met" | "missing" | "unclear" | "to_prepare";
  expired: boolean;
  documentName: string | null;
}

export interface PlanField {
  key: string;
  value: string | null;
  status: FieldStatus;
  pageNo: number | null;
  role: "main" | "addendum";
  ordinal: number;
  label?: string;
}

export interface ActionPlanItem {
  key: string;
  section: PlanSection;
  kind: ActionKind;
  title: string;
  detail: string;
  pageNo: number | null;
  /** Set on questions, so they can be copied without the surrounding label. */
  question: string | null;
}

export interface ActionPlan {
  documents: ActionPlanItem[];
  questions: ActionPlanItem[];
  outline: ActionPlanItem[];
  dates: ActionPlanItem[];
  items: ActionPlanItem[];
}

export interface SavedAction {
  itemKey: string;
  ownerName: string | null;
  dueOn: string | null;
  done: boolean;
}

export interface PlanRow extends ActionPlanItem {
  ownerName: string;
  dueOn: string;
  done: boolean;
}

const QUESTION_KEYS = new Set<string>([...SCALAR_FIELD_KEYS, "evaluation_criterion"]);

const QUESTION_SUBJECT: Record<string, string> = {
  performance_security: "performance security amount",
  bid_security: "bid security amount",
  closing_datetime: "submission deadline",
  payment_days: "payment period",
  late_payment_interest: "late-payment interest rate",
  advance_payment: "advance payment",
  evaluation_criterion: "evaluation criterion",
};

/** A past-contract line is not a paper to go and collect. */
const EXPERIENCE_LINE =
  /similar (?:works|work|contracts|contract|projects|project)|years? of experience|reference sites?/i;

const CLARIFICATION_DEADLINE =
  /clarification deadline|deadline for clarifications?|last (?:date|day) (?:for|to) (?:seek |submit )?(?:clarifications?|queries|enquiries)|clarifications? (?:must|shall|to) be (?:sought|submitted|received|sent) (?:by|before|on)/i;

const SITE_VISIT = /site visit|pre-bid conference|pre-bid meeting|pre-bid site/i;

interface Draft {
  section: PlanSection;
  kind: ActionKind;
  title: string;
  detail: string;
  pageNo: number | null;
  question: string | null;
  identity: string;
}

/** Missing or expired mandatory documents. Experience lines are left out. */
export function isDocumentToGet(item: { match: string; text: string }): boolean {
  return item.match === "missing" && !EXPERIENCE_LINE.test(item.text);
}

export function daysLeftLabel(days: number | null): string {
  if (days === null) return "Days left are not shown.";
  if (days === 0) return "Due today.";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left.`;
  const ago = Math.abs(days);
  return `${ago} day${ago === 1 ? "" : "s"} ago.`;
}

/** One polite question. Blank and needs-human use the page when we have it. */
export function clarificationQuestion(input: {
  key: string;
  label: string;
  status: FieldStatus;
  pageNo: number | null;
}): string {
  const subject = QUESTION_SUBJECT[input.key] ?? input.label.toLowerCase();
  if (input.status === "blank_in_source") {
    return input.pageNo === null
      ? `Please confirm the ${subject} (the source leaves it blank).`
      : `Please confirm the ${subject} (page ${input.pageNo} is blank).`;
  }
  return input.pageNo === null
    ? `Please confirm the ${subject} (it needs a person to check).`
    : `Please confirm the ${subject} (page ${input.pageNo} needs a person to check).`;
}

export function planFinding(plan: ActionPlan): string {
  if (plan.items.length === 0) return "Nothing to prepare from the extracted facts.";
  const documents = plan.documents.length;
  const questions = plan.questions.length;
  const sections = plan.outline.length;
  return `${documents} document${documents === 1 ? "" : "s"} to get, ${questions} question${questions === 1 ? "" : "s"} for the buyer, and ${sections} section${sections === 1 ? "" : "s"} to include.`;
}

export function mergeSaved(plan: ActionPlan, saved: readonly SavedAction[]): PlanRow[] {
  const byKey = new Map(saved.map((row) => [row.itemKey, row]));
  return plan.items.map((item) => {
    const row = byKey.get(item.key);
    return {
      ...item,
      ownerName: row?.ownerName?.trim() ?? "",
      dueOn: row?.dueOn ?? "",
      done: row?.done === true,
    };
  });
}

export function planProgress(rows: readonly { done: boolean }[]): { done: number; total: number; label: string } {
  const total = rows.length;
  const done = rows.filter((row) => row.done).length;
  return { done, total, label: `${done} of ${total} done` };
}

function labelFor(field: PlanField): string {
  if (field.label?.trim()) return field.label.trim();
  if (field.key in FIELD_SPECS) return FIELD_SPECS[field.key as TenderFieldKey].label;
  return field.key.replaceAll("_", " ");
}

function open(field: PlanField): boolean {
  return field.status === "blank_in_source" || field.status === "needs_human";
}

function slug(text: string): string {
  const flat = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return flat.slice(0, 72) || "item";
}

function finish(drafts: readonly Draft[]): ActionPlanItem[] {
  const counts = new Map<string, number>();
  return drafts.map((draft) => {
    const base = `${draft.section}:${draft.identity}`;
    const seen = (counts.get(base) ?? 0) + 1;
    counts.set(base, seen);
    return {
      key: seen === 1 ? base : `${base}-${seen}`,
      section: draft.section,
      kind: draft.kind,
      title: draft.title,
      detail: draft.detail,
      pageNo: draft.pageNo,
      question: draft.question,
    };
  });
}

function line(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pool(fields: readonly PlanField[], key: string): PlanField[] {
  const all = fields.filter((field) => field.key === key);
  const main = all.filter((field) => field.role === "main");
  return main.length > 0 ? main : all;
}

/** Latest role wins. An addendum that states the fact closes the question. */
function unresolvedScalar(fields: readonly PlanField[], key: string): PlanField | null {
  const group = fields.filter((field) => field.key === key);
  if (group.length === 0) return null;
  const addendum = group.filter((field) => field.role === "addendum");
  const latest = addendum.length > 0 ? addendum : group;
  if (latest.some((field) => field.value && !open(field))) return null;
  return latest.find(open) ?? null;
}

function documentDrafts(requirements: readonly PlanRequirement[]): Draft[] {
  return requirements.filter(isDocumentToGet).map((requirement) => {
    const text = line(requirement.text);
    const state = requirement.expired ? "Expired" : "Missing";
    const record = requirement.documentName?.replace(/\s+/g, " ").trim();
    return {
      section: "documents",
      kind: "document",
      title: text,
      detail: record ? `${state}. Company record: ${record}.` : `${state}.`,
      pageNo: requirement.pageNo,
      question: null,
      identity: `${requirement.pageNo ?? "x"}:${slug(text)}`,
    };
  });
}

function questionDrafts(fields: readonly PlanField[]): Draft[] {
  const scalars = SCALAR_FIELD_KEYS.flatMap((key) => {
    const field = unresolvedScalar(fields, key);
    return field ? [field] : [];
  });
  const criteria = pool(fields, "evaluation_criterion")
    .filter(open)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal);
  return [...scalars, ...criteria].filter((field) => QUESTION_KEYS.has(field.key)).map((field) => {
    const label = labelFor(field);
    const question = clarificationQuestion({
      key: field.key,
      label,
      status: field.status,
      pageNo: field.pageNo,
    });
    return {
      section: "questions" as const,
      kind: "question" as const,
      title: question,
      detail: label,
      pageNo: field.pageNo,
      question,
      identity: `${field.key}:${field.role}:${field.ordinal}`,
    };
  });
}

function outlineDrafts(requirements: readonly PlanRequirement[], fields: readonly PlanField[]): Draft[] {
  const criteria = pool(fields, "evaluation_criterion")
    .filter((field) => field.value)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal || (a.pageNo ?? 0) - (b.pageNo ?? 0));
  const fromCriteria: Draft[] = criteria.map((field) => {
    const text = line(field.value ?? "");
    return {
      section: "outline",
      kind: "outline",
      title: text,
      detail: "Evaluation criterion",
      pageNo: field.pageNo,
      question: null,
      identity: `evaluation:${field.role}:${field.ordinal}:${slug(text)}`,
    };
  });
  const fromRequirements: Draft[] = requirements.map((requirement) => {
    const text = line(requirement.text);
    return {
      section: "outline",
      kind: "outline",
      title: text,
      detail: "Mandatory requirement",
      pageNo: requirement.pageNo,
      question: null,
      identity: `requirement:${slug(text)}`,
    };
  });
  return [...fromCriteria, ...fromRequirements];
}

function eventField(fields: readonly PlanField[], pattern: RegExp): PlanField | null {
  const hits = fields.filter(
    (field) =>
      field.key !== "closing_datetime" &&
      field.value !== null &&
      pattern.test(field.value) &&
      parseClosingText(field.value) !== null,
  );
  return hits.find((field) => field.role === "addendum") ?? hits.find((field) => field.role === "main") ?? hits[0] ?? null;
}

function datedLine(value: string, days: number | null): string {
  const text = line(value);
  const stopped = /[.!?]$/.test(text) ? text : `${text}.`;
  return `${stopped} ${daysLeftLabel(days)}`;
}

function dateDraft(
  identity: "submission" | "clarification" | "site-visit",
  title: string,
  value: string | null,
  pageNo: number | null,
  days: number | null,
): Draft {
  return {
    section: "dates",
    kind: "date",
    title,
    detail: value ? datedLine(value, days) : "Not stated in the extracted facts.",
    pageNo,
    question: null,
    identity,
  };
}

function dateDrafts(fields: readonly PlanField[], deadlineAt: string | null, asOf: Date): Draft[] {
  const closings = fields.filter((field) => field.key === "closing_datetime" && field.value);
  const closing = closings.find((field) => field.role === "addendum") ?? closings.find((field) => field.role === "main") ?? null;
  const written = closingLabel(closing?.value ?? null, deadlineAt);
  const days = daysUntilDeadline({ deadlineAt, closingText: closing?.value ?? null, asOf });
  const drafts = [
    dateDraft("submission", "Submission deadline", written, closing?.pageNo ?? null, written ? days : null),
  ];
  const clarification = eventField(fields, CLARIFICATION_DEADLINE);
  if (clarification?.value) {
    drafts.push(
      dateDraft(
        "clarification",
        "Clarification deadline",
        clarification.value,
        clarification.pageNo,
        daysUntilDeadline({ deadlineAt: null, closingText: clarification.value, asOf }),
      ),
    );
  }
  const visit = eventField(fields, SITE_VISIT);
  if (visit?.value) {
    drafts.push(
      dateDraft(
        "site-visit",
        "Site visit",
        visit.value,
        visit.pageNo,
        daysUntilDeadline({ deadlineAt: null, closingText: visit.value, asOf }),
      ),
    );
  }
  return drafts;
}

export function buildActionPlan(input: {
  requirements: readonly PlanRequirement[];
  fields: readonly PlanField[];
  deadlineAt: string | null;
  asOf: Date;
}): ActionPlan {
  const documents = finish(documentDrafts(input.requirements));
  const questions = finish(questionDrafts(input.fields));
  const outline = finish(outlineDrafts(input.requirements, input.fields));
  const dates = finish(dateDrafts(input.fields, input.deadlineAt, input.asOf));
  return {
    documents,
    questions,
    outline,
    dates,
    items: [...documents, ...questions, ...outline, ...dates],
  };
}
