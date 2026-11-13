import { z } from "zod";

import { countyScoreLine } from "@/lib/format/display";

/** The three assessment steps. Insert-only rows in `stage_reviews.stage`. */
export const REVIEW_STAGES = ["can_bid", "can_comply", "should_bid"] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export interface StageReviewRecord {
  stage: ReviewStage;
  reviewerName: string;
  note: string | null;
  createdAt: string;
}

export interface StageReviewDraft {
  tenderId: string;
  stage: ReviewStage;
  reviewerName: string;
  note: string | null;
}

const stageReviewSchema = z.object({
  tenderId: z.uuid(),
  stage: z.enum(REVIEW_STAGES),
  reviewerName: z.string().trim().min(1, "Enter your name.").max(120, "Name is too long."),
  note: z.string().trim().max(1000, "Note is too long."),
});

export function parseStageReview(input: unknown): { ok: true; value: StageReviewDraft } | { ok: false; error: string } {
  const parsed = stageReviewSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "stage") return { ok: false, error: "Choose a step to review." };
    if (issue?.path[0] === "tenderId") return { ok: false, error: "That tender was not found." };
    return { ok: false, error: issue?.message ?? "Check the review and try again." };
  }
  return {
    ok: true,
    value: {
      tenderId: parsed.data.tenderId,
      stage: parsed.data.stage,
      reviewerName: parsed.data.reviewerName,
      note: parsed.data.note.length > 0 ? parsed.data.note : null,
    },
  };
}

/** Newest row per step. A later review does not erase the earlier one. */
export function latestByStage(
  reviews: readonly StageReviewRecord[],
): Record<ReviewStage, StageReviewRecord | null> {
  const latest: Record<ReviewStage, StageReviewRecord | null> = {
    can_bid: null,
    can_comply: null,
    should_bid: null,
  };
  for (const review of reviews) {
    const current = latest[review.stage];
    if (!current || review.createdAt > current.createdAt) latest[review.stage] = review;
  }
  return latest;
}

/** Nairobi time, for the tick on a reviewed step. */
export function formatReviewedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
    hourCycle: "h23",
  }).format(date);
}

/**
 * `facts` is every extracted field except blank-in-source.
 * Those blanks are named on their own, and are not part of "Found N facts".
 */
export function interpretationFinding(input: { facts: number; needsHuman: number; unfilled?: number }): string {
  const unfilled = input.unfilled ?? 0;
  const unfilledSentence = unfilled > 0 ? `Not filled in by the buyer: ${unfilled}.` : null;
  if (input.facts === 0) {
    return unfilledSentence ?? "No key facts were extracted from this tender yet.";
  }
  const facts = `Found ${input.facts} fact${input.facts === 1 ? "" : "s"}`;
  const head =
    input.needsHuman === 0
      ? `${facts}.`
      : `${facts}, and ${input.needsHuman} still ${input.needsHuman === 1 ? "needs" : "need"} a person to check.`;
  return unfilledSentence ? `${head} ${unfilledSentence}` : head;
}

/** Pages with no text layer. "2 pages couldn't be read (p.4, 18)". */
export function unreadPagesNotice(pages: readonly number[]): string | null {
  const sorted = [...new Set(pages)].filter((page) => Number.isFinite(page)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const shown = sorted.slice(0, 12);
  const tail = sorted.length > 12 ? ", …" : "";
  const noun = sorted.length === 1 ? "page" : "pages";
  return `${sorted.length} ${noun} couldn't be read (p.${shown.join(", ")}${tail})`;
}

const BOND = /bid bond|tender security|bid security/i;
const KES_AMOUNT = /(?:kshs?\.?|kes)\s*([0-9][0-9,]*(?:\.\d+)?)/i;

function kesDigits(raw: string): string {
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return raw;
  const whole = Math.abs(value - Math.round(value)) < 0.001;
  const digits = whole ? String(Math.round(value)) : value.toFixed(2);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** One short name. A bid bond keeps the amount and drops the rest of the clause. */
function requirementName(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim().replace(/^\d+\.\s*/, "").replace(/\.+$/, "");
  if (BOND.test(flat)) {
    const amount = KES_AMOUNT.exec(flat);
    return amount ? `the KSh ${kesDigits(amount[1])} bid bond` : "the bid bond";
  }
  if (flat.length <= 72) return flat;
  return `${flat.slice(0, 71).trimEnd()}…`;
}

export function complianceFinding(input: {
  met: number;
  gaps: number;
  /** The open requirement to name. Null when nothing is open. */
  missingText?: string | null;
  /** Every open item is unclear, rather than missing. */
  unclear?: boolean;
}): string {
  const scored = input.met + input.gaps;
  if (scored === 0) return "No mandatory requirements were extracted from this tender.";
  if (input.gaps === 0) return `All ${scored} requirements are covered.`;
  const covered =
    input.met === 0
      ? scored === 1
        ? "The requirement is not covered"
        : `None of the ${scored} requirements are covered`
      : `${input.met} of ${scored} requirements are covered`;
  const name = requirementName(input.missingText?.trim() || "A requirement");
  const state = input.unclear ? "not clearly covered" : "missing";
  if (input.gaps === 1) return `${covered}; ${name} is ${state}.`;
  const others = input.gaps - 1;
  return `${covered}; ${name} and ${others} other${others === 1 ? "" : "s"} are ${state}.`;
}

export function commercialFinding(
  input: { county: string; score: number; bandLabel: string } | null,
): string {
  if (!input) return "No county payment score for this buyer.";
  return `${input.county} scores ${countyScoreLine(input.score, input.bandLabel)}. This is the stock of unpaid bills, not a date the buyer will pay.`;
}

export function preparationFinding(done: number, total: number): string {
  if (total === 0) return "Nothing to prepare from the extracted facts.";
  if (done <= 0) return `None of the ${total} preparation item${total === 1 ? "" : "s"} are marked done yet.`;
  if (done >= total) return total === 1 ? "The preparation item is marked done." : `All ${total} preparation items are marked done.`;
  return `${done} of ${total} preparation items are marked done.`;
}

/** One line under the stage sentence. The first stage has nothing to carry. */
export function carriedFrom(stage: string, sentence: string): string {
  const flat = sentence.replace(/\s+/g, " ").trim();
  const short = flat.length > 140 ? `${flat.slice(0, 139).trimEnd()}…` : flat;
  return `Carried from ${stage}: ${short}`;
}

const SOFT_START = /^(All|None|No|Found|Nothing)\b/;

function asBecause(sentence: string): string {
  let text = sentence.trim().replace(/\.+$/, "");
  if (SOFT_START.test(text)) text = text.charAt(0).toLowerCase() + text.slice(1);
  return `Because ${text}.`;
}

function mentioned(lines: readonly string[], text: string): boolean {
  const needle = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 4) return false;
  return lines.some((line) => line.toLowerCase().includes(needle));
}

function openClause(
  open: readonly { label: string; status: "blank_in_source" | "needs_human" }[],
  already: readonly string[],
): string | null {
  const fresh = open.filter((item) => item.label.trim() && !mentioned(already, item.label));
  if (fresh.length === 0) return null;
  const phrase = (item: (typeof fresh)[number]) => {
    const label = item.label.trim();
    const name = label.charAt(0).toLowerCase() + label.slice(1);
    return item.status === "blank_in_source" ? `${name} is blank in the source` : `${name} needs a person to check`;
  };
  if (fresh.length === 1) return phrase(fresh[0]);
  const others = fresh.length - 1;
  return `${phrase(fresh[0])}, and ${others} other open question${others === 1 ? "" : "s"}`;
}

/** Up to three bullets: compliance, commercial, then blanks or an unresolved conflict. */
export function becauseBullets(input: {
  compliance: string;
  commercial: string;
  open: readonly { label: string; status: "blank_in_source" | "needs_human" }[];
  /** A short clause, with no period: a conflict or a passed closing date. */
  unresolved?: string | null;
}): string[] {
  const bullets: string[] = [];
  if (input.compliance.trim()) bullets.push(asBecause(input.compliance));
  if (input.commercial.trim() && bullets.length < 3) bullets.push(asBecause(input.commercial));
  const open = openClause(input.open, bullets);
  const unresolved = input.unresolved?.trim() || null;
  const unresolvedFresh = unresolved && !mentioned(bullets, unresolved) ? unresolved : null;
  let third: string | null = null;
  if (open && unresolvedFresh) third = `${open}, and ${unresolvedFresh}`;
  else third = open ?? unresolvedFresh;
  if (third && bullets.length < 3) bullets.push(asBecause(third));
  return bullets.slice(0, 3);
}

/** One clause for the third recommendation bullet. Null when nothing is unresolved. */
export function unresolvedClause(input: {
  securityConflict: boolean;
  addendumConflicts: number;
  closed: boolean;
}): string | null {
  const parts: string[] = [];
  if (input.securityConflict) parts.push("bid security amounts disagree");
  if (input.addendumConflicts === 1) parts.push("an addendum conflicts with the main document");
  else if (input.addendumConflicts > 1) {
    parts.push(`${input.addendumConflicts} addendum lines conflict with the main document`);
  }
  if (input.closed) parts.push("the closing date has passed");
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/**
 * "Approved by … at …" only when this stage's review is the newest review.
 * A later review on another stage hides the line. No review shows nothing.
 */
export function stageApprovalLine(input: {
  review: { reviewerName: string; createdAt: string; action: "approve" | "override" } | null;
  others: readonly { createdAt: string }[];
}): string | null {
  const review = input.review;
  if (!review) return null;
  if (input.others.some((row) => row.createdAt > review.createdAt)) return null;
  const verb = review.action === "override" ? "Overridden" : "Approved";
  return `${verb} by ${review.reviewerName} at ${formatReviewedAt(review.createdAt)}`;
}
