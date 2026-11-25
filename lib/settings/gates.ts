import { REVIEW_STAGES, type ReviewStage } from "@/lib/tenders/stage-review";

/** Settings → Review gates. A bid decision needs all three stage reviews when the gate is on. */
export const STAGE_REVIEWS_REQUIRED_MESSAGE =
  "Review Interpretation, Compliance and Commercial before recording the decision. This is turned on in Settings.";

export function stageReviewsMissing(reviewed: readonly ReviewStage[]): ReviewStage[] {
  return REVIEW_STAGES.filter((stage) => !reviewed.includes(stage));
}
