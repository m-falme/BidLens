import { z } from "zod";

import { RECOMMENDATION_LABELS, type RecommendationLabel } from "./labels";

export const DECISION_ACTIONS = ["approve", "override"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export interface BidDecisionDraft {
  tenderId: string;
  recommendedLabel: RecommendationLabel;
  finalLabel: RecommendationLabel;
  action: DecisionAction;
  reason: string | null;
  reviewerName: string;
}

export interface BidDecisionRecord {
  recommendedLabel: RecommendationLabel;
  finalLabel: RecommendationLabel;
  action: DecisionAction;
  reason: string | null;
  reviewerName: string;
  createdAt: string;
}

const bidDecisionSchema = z.object({
  tenderId: z.uuid(),
  recommendedLabel: z.enum(RECOMMENDATION_LABELS),
  finalLabel: z.enum(RECOMMENDATION_LABELS),
  action: z.enum(DECISION_ACTIONS),
  reason: z.string().trim().max(1000, "Reason is too long."),
  reviewerName: z.string().trim().min(1, "Enter your name.").max(120, "Name is too long."),
});

export function parseBidDecision(
  input: unknown,
): { ok: true; value: BidDecisionDraft } | { ok: false; error: string } {
  const parsed = bidDecisionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "reviewerName") return { ok: false, error: issue.message };
    if (issue?.path[0] === "reason") return { ok: false, error: issue.message };
    if (issue?.path[0] === "tenderId") return { ok: false, error: "That tender was not found." };
    if (issue?.path[0] === "finalLabel" || issue?.path[0] === "recommendedLabel") {
      return { ok: false, error: "Choose a recommendation." };
    }
    return { ok: false, error: issue?.message ?? "Check the decision and try again." };
  }

  const data = parsed.data;
  if (data.action === "approve") {
    if (data.finalLabel !== data.recommendedLabel) {
      return { ok: false, error: "Approve keeps the recommended label." };
    }
    return {
      ok: true,
      value: {
        tenderId: data.tenderId,
        recommendedLabel: data.recommendedLabel,
        finalLabel: data.finalLabel,
        action: "approve",
        reason: data.reason.length > 0 ? data.reason : null,
        reviewerName: data.reviewerName,
      },
    };
  }

  if (data.finalLabel === data.recommendedLabel) {
    return { ok: false, error: "Choose a different label." };
  }
  if (data.reason.length === 0) {
    return { ok: false, error: "Enter a reason for the override." };
  }
  return {
    ok: true,
    value: {
      tenderId: data.tenderId,
      recommendedLabel: data.recommendedLabel,
      finalLabel: data.finalLabel,
      action: "override",
      reason: data.reason,
      reviewerName: data.reviewerName,
    },
  };
}
