import type { StageReviewRecord } from "@/lib/tenders/stage-review";

import type { BidDecisionRecord } from "./decision";
import { RECOMMENDATION_LABEL, type RecommendationLabel } from "./labels";

export interface TrailEntry {
  at: string;
  who: string;
  what: string;
  note: string | null;
  kind: "review" | "approve" | "override";
}

/** Display text only. Stored stage values stay can_bid, can_comply, should_bid. */
const STAGE_WHAT: Record<StageReviewRecord["stage"], string> = {
  can_bid: "Interpretation reviewed",
  can_comply: "Compliance reviewed",
  should_bid: "Commercial reviewed",
};

export function latestBidDecision(rows: readonly BidDecisionRecord[]): BidDecisionRecord | null {
  let latest: BidDecisionRecord | null = null;
  for (const row of rows) {
    if (!latest || row.createdAt > latest.createdAt) latest = row;
  }
  return latest;
}

export function latestLabelByTender(
  rows: readonly { tenderId: string; finalLabel: RecommendationLabel; createdAt: string }[],
): Map<string, RecommendationLabel> {
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const latest = new Map<string, RecommendationLabel>();
  for (const row of sorted) {
    if (!latest.has(row.tenderId)) latest.set(row.tenderId, row.finalLabel);
  }
  return latest;
}

/** Stage reviews and bid decisions, newest first. */
export function decisionTrail(
  reviews: readonly StageReviewRecord[],
  decisions: readonly BidDecisionRecord[],
): TrailEntry[] {
  const entries: TrailEntry[] = [
    ...reviews.map((review) => ({
      at: review.createdAt,
      who: review.reviewerName,
      what: STAGE_WHAT[review.stage],
      note: review.note,
      kind: "review" as const,
    })),
    ...decisions.map((decision) => ({
      at: decision.createdAt,
      who: decision.reviewerName,
      what:
        decision.action === "approve"
          ? `Approved ${RECOMMENDATION_LABEL[decision.finalLabel]}`
          : `Overrode the recommendation to ${RECOMMENDATION_LABEL[decision.finalLabel]}`,
      note: decision.reason,
      kind: decision.action,
    })),
  ];
  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
