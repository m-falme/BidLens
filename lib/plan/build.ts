import type { FieldStatus } from "@/lib/db/vocab";
import { closingLabel } from "@/lib/format/display";
import { daysUntilClosing, preferredClosing } from "@/lib/recommendation/deadline";
import { isCompanyRecordName } from "@/lib/readiness/match";
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
  /** A document the company still does not hold. A tick on it does not count as done. */
  missing: boolean;
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

const BOND = /\b(?:bid bond|tender security|bid security)\b/i;

const BOND_VALIDITY =
  /(?:must\s+)?remain\s+valid\s+for\s+\d+\s+days(?:\s+after\s+[^.]{0,80})?|valid\s+for\s+\d+\s+days(?:\s+(?:after|beyond|from)\s+[^.]{0,80})?|validity(?:\s+period)?\s+of\s+\d+\s+days(?:\s+(?:after|beyond|from)\s+[^.]{0,80})?/i;

interface Draft {
  section: PlanSection;
  kind: ActionKind;
  title: string;
  detail: string;
  pageNo: number | null;
  question: string | null;
  identity: string;
  missing: boolean;
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

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function planFinding(plan: ActionPlan): string {
  if (plan.items.length === 0) return "Nothing to prepare from the extracted facts.";
  return `${counted(plan.documents.length, "document", "documents")} to get, ${counted(plan.questions.length, "question", "questions")} for the buyer, and ${counted(plan.outline.length, "item", "items")} to prepare.`;
}

export function mergeSaved(plan: ActionPlan, saved: readonly SavedAction[]): PlanRow[] {
  const byKey = new Map(saved.map((row) => [row.itemKey, row]));
  return plan.items.map((item) => {
    const row = byKey.get(item.key);
    return {
      ...item,
      ownerName: row?.ownerName?.trim() ?? "",
      dueOn: row?.dueOn ?? "",
      done: row?.done === true && !item.missing,
    };
  });
}

/**
 * Done is only a tick the team saved. It starts at 0.
 * A Missing document stays in the total and never counts as done.
 */
export function planProgress(rows: readonly { done: boolean; missing?: boolean }[]): {
  done: number;
  total: number;
  missing: number;
  label: string;
} {
  const total = rows.length;
  const missing = rows.filter((row) => row.missing === true).length;
  const done = rows.filter((row) => row.done && row.missing !== true).length;
  return { done, total, missing, label: `${done} of ${total}` };
}

/** Every item is ticked. A Missing document cannot be ticked, so it keeps this false. An empty plan is done. */
export function preparationIsDone(progress: { done: number; total: number }): boolean {
  return progress.done === progress.total;
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
      missing: draft.missing,
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
      missing: false,
    };
  });
}

/** Sentences that say how the bid bond is handed in. The "get the bond" sentence stays a document. */
function bondDeliverySteps(text: string): string[] {
  if (!BOND.test(text)) return [];
  const chunks = line(text)
    .split(/\s+(?=Note:\s|Additionally,\s)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length < 2) return [];
  return chunks.slice(1).filter((chunk) => /upload|deliver|tender box|separate envelope|ifmis/i.test(chunk));
}

function bondValidityPhrase(text: string): string | null {
  const match = text.match(BOND_VALIDITY);
  return match ? line(match[0]) : null;
}

function documentDrafts(requirements: readonly PlanRequirement[]): Draft[] {
  const documents = requirements.filter(isDocumentToGet).map((requirement) => {
    const text = line(requirement.text);
    const state = requirement.expired ? "Expired" : "Missing";
    const named = requirement.documentName?.replace(/\s+/g, " ").trim() ?? "";
    const record = named && isCompanyRecordName(named) ? named : "";
    return {
      section: "documents" as const,
      kind: "document" as const,
      title: text,
      detail: record ? `${state}. Company record: ${record}.` : `${state}.`,
      pageNo: requirement.pageNo,
      question: null,
      identity: `${requirement.pageNo ?? "x"}:${slug(text)}`,
      missing: state === "Missing",
    };
  });
  const steps = requirements.flatMap((requirement) =>
    bondDeliverySteps(requirement.text).map((step) => ({
      section: "documents" as const,
      kind: "document" as const,
      title: step,
      detail: "Bid bond delivery.",
      pageNo: requirement.pageNo,
      question: null,
      identity: `bond-step:${requirement.pageNo ?? "x"}:${slug(step)}`,
      missing: false,
    })),
  );
  return [...documents, ...steps];
}

/** Forms to fill, then the response sections. The compliance checklist is not repeated here. */
function prepareDrafts(requirements: readonly PlanRequirement[], fields: readonly PlanField[]): Draft[] {
  const forms: Draft[] = requirements
    .filter((requirement) => requirement.match === "to_prepare")
    .map((requirement) => {
      const text = line(requirement.text);
      return {
        section: "outline",
        kind: "outline",
        title: text,
        detail: "Form",
        pageNo: requirement.pageNo,
        question: null,
        identity: `form:${slug(text)}`,
        missing: false,
      };
    });
  const criteria = pool(fields, "evaluation_criterion")
    .filter((field) => field.value)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal || (a.pageNo ?? 0) - (b.pageNo ?? 0));
  const response: Draft[] = criteria.map((field) => {
    const text = line(field.value ?? "");
    return {
      section: "outline",
      kind: "outline",
      title: text,
      detail: "Response",
      pageNo: field.pageNo,
      question: null,
      identity: `evaluation:${field.role}:${field.ordinal}:${slug(text)}`,
      missing: false,
    };
  });
  return [...forms, ...response];
}

function statedScalar(fields: readonly PlanField[], key: string): PlanField | null {
  const group = fields.filter((field) => field.key === key && field.value?.trim());
  return group.find((field) => field.role === "addendum") ?? group.find((field) => field.role === "main") ?? null;
}

function bondValidity(requirements: readonly PlanRequirement[], fields: readonly PlanField[]): { phrase: string; pageNo: number | null } | null {
  for (const requirement of requirements) {
    if (!BOND.test(requirement.text)) continue;
    const phrase = bondValidityPhrase(requirement.text);
    if (phrase) return { phrase, pageNo: requirement.pageNo };
  }
  for (const role of ["addendum", "main"] as const) {
    const field = fields.find((item) => item.key === "bid_security" && item.role === role && item.value?.trim());
    const phrase = field?.value ? bondValidityPhrase(field.value) : null;
    if (field && phrase) return { phrase, pageNo: field.pageNo };
  }
  return null;
}

function datedLine(value: string, days: number | null): string {
  const text = line(value);
  const stopped = /[.!?]$/.test(text) ? text : `${text}.`;
  return `${stopped} ${daysLeftLabel(days)}`;
}

function dateDraft(
  identity: "closing" | "bid-validity" | "bond-validity",
  title: string,
  value: string | null,
  pageNo: number | null,
  days: number | null,
): Draft {
  return {
    section: "dates",
    kind: "date",
    title,
    detail: value ? (days === null ? (/[.!?]$/.test(line(value)) ? line(value) : `${line(value)}.`) : datedLine(value, days)) : "Not stated in the extracted facts.",
    pageNo,
    question: null,
    identity,
    missing: false,
  };
}

function dateDrafts(
  requirements: readonly PlanRequirement[],
  fields: readonly PlanField[],
  deadlineAt: string | null,
  asOf: Date,
): Draft[] {
  const closing = preferredClosing(fields);
  const written = closingLabel(closing?.value ?? null, deadlineAt);
  const days = daysUntilClosing({ closingText: closing?.value ?? null, deadlineAt, asOf });
  const validity = statedScalar(fields, "tender_validity");
  const bond = bondValidity(requirements, fields);
  return [
    dateDraft("closing", "Closing date and time", written, closing?.pageNo ?? null, written ? days : null),
    dateDraft("bid-validity", "Bid validity", validity?.value ?? null, validity?.pageNo ?? null, null),
    dateDraft("bond-validity", "Bond validity", bond?.phrase ?? null, bond?.pageNo ?? null, null),
  ];
}

export function buildActionPlan(input: {
  requirements: readonly PlanRequirement[];
  fields: readonly PlanField[];
  deadlineAt: string | null;
  asOf: Date;
}): ActionPlan {
  const documents = finish(documentDrafts(input.requirements));
  const questions = finish(questionDrafts(input.fields));
  const outline = finish(prepareDrafts(input.requirements, input.fields));
  const dates = finish(dateDrafts(input.requirements, input.fields, input.deadlineAt, input.asOf));
  return {
    documents,
    questions,
    outline,
    dates,
    items: [...documents, ...questions, ...outline, ...dates],
  };
}
