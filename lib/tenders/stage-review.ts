import { z } from "zod";

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

export function interpretationFinding(input: { facts: number; needsHuman: number }): string {
  if (input.facts === 0) return "No key facts were extracted from this tender yet.";
  const facts = `Found ${input.facts} fact${input.facts === 1 ? "" : "s"}.`;
  if (input.needsHuman === 0) return facts;
  return `${facts} ${input.needsHuman} still need a person to check.`;
}

export function complianceFinding(input: {
  met: number;
  gaps: number;
  couldDisqualify: number;
  toPrepare: number;
  total: number;
}): string {
  if (input.total === 0) return "No mandatory requirements were extracted from this tender.";
  const prepare = input.toPrepare > 0 ? `, ${input.toPrepare} to prepare` : "";
  return `${input.met} met, ${input.gaps} gap${input.gaps === 1 ? "" : "s"}${prepare}, ${input.couldDisqualify} could disqualify.`;
}

export function commercialFinding(
  input: { county: string; score: number; bandLabel: string } | null,
): string {
  if (!input) return "No county payment score for this buyer.";
  return `${input.county} scores ${input.score.toFixed(1)} (${input.bandLabel}). This is the stock of unpaid bills, not a date the buyer will pay.`;
}
