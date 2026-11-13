/** The four recommendation labels. Code chooses one. A person approves or overrides it. */

export const RECOMMENDATION_LABELS = [
  "consider_declining",
  "resolve_blockers",
  "seek_clarification",
  "proceed_to_preparation",
] as const;
export type RecommendationLabel = (typeof RECOMMENDATION_LABELS)[number];

export const RECOMMENDATION_LABEL: Record<RecommendationLabel, string> = {
  consider_declining: "Consider declining",
  resolve_blockers: "Resolve blockers",
  seek_clarification: "Seek clarification",
  proceed_to_preparation: "Proceed to preparation",
};

/** Status colour is meaning only: green proceed, amber still open, red decline, grey none. */
export const RECOMMENDATION_CLASS: Record<RecommendationLabel | "none", string> = {
  consider_declining: "bg-blocker/12 text-blocker",
  resolve_blockers: "bg-warning/15 text-warning",
  seek_clarification: "bg-warning/15 text-warning",
  proceed_to_preparation: "bg-confirmed/10 text-confirmed",
  none: "bg-muted text-muted-foreground",
};

/** Checked in this order. The first match is the one that fired. */
export const RECOMMENDATION_RULES = [
  "unfixable_disqualifier",
  "severe_without_value",
  "fixable_gaps",
  "unclear_key_facts",
  "document_conflict",
  "deadline_passed",
  "clear",
] as const;
export type RecommendationRule = (typeof RECOMMENDATION_RULES)[number];

export const RULE_TEXT: Record<RecommendationRule, string> = {
  unfixable_disqualifier: "Could disqualify us, and it cannot be fixed before the deadline",
  severe_without_value: "Payment risk is Severe and no contract value is recorded",
  fixable_gaps: "Missing mandatory documents or gaps that can be fixed",
  unclear_key_facts: "Deadline, security or evaluation is blank or needs a person",
  document_conflict: "Bid security amounts disagree, or an addendum conflicts with the main document",
  deadline_passed: "Closing date has passed",
  clear: "No decline, blocker or clarification rule matched",
};

export interface RecommendationReason {
  /** Plain sentence. */
  text: string;
  /** The requirement, fact or figure this sentence is about. */
  item: string;
}

export interface Recommendation {
  label: RecommendationLabel;
  rule: RecommendationRule;
  reasons: RecommendationReason[];
}

export function asRecommendationLabel(value: string | null | undefined): RecommendationLabel | null {
  return RECOMMENDATION_LABELS.find((label) => label === value) ?? null;
}
