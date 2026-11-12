import "server-only";

import {
  DECISION_ACTIONS,
  type BidDecisionDraft,
  type BidDecisionRecord,
  type DecisionAction,
} from "@/lib/recommendation/decision";
import { asRecommendationLabel } from "@/lib/recommendation/labels";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function asAction(value: string): DecisionAction | null {
  return DECISION_ACTIONS.find((action) => action === value) ?? null;
}

export async function listBidDecisions(tenderId: string): Promise<BidDecisionRecord[]> {
  const { data, error } = await getServiceClient()
    .from("bid_decisions")
    .select("recommended_label, final_label, action, reason, reviewer_name, created_at")
    .eq("tender_id", tenderId)
    .order("created_at", { ascending: true });
  if (error) fail("load bid decisions", error);
  return data.flatMap((row) => {
    const recommendedLabel = asRecommendationLabel(row.recommended_label);
    const finalLabel = asRecommendationLabel(row.final_label);
    const action = asAction(row.action);
    if (!recommendedLabel || !finalLabel || !action) return [];
    return [
      {
        recommendedLabel,
        finalLabel,
        action,
        reason: row.reason,
        reviewerName: row.reviewer_name,
        createdAt: row.created_at,
      },
    ];
  });
}

/** Append one decision. The tender must belong to the signed-in workspace. */
export async function insertBidDecision(draft: BidDecisionDraft): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: tender, error: tenderError } = await db
    .from("opportunities")
    .select("id")
    .eq("id", draft.tenderId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (tenderError) fail("load tender for decision", tenderError);
  if (!tender) throw new Error("That tender was not found.");

  const { error } = await db.from("bid_decisions").insert({
    tender_id: draft.tenderId,
    recommended_label: draft.recommendedLabel,
    final_label: draft.finalLabel,
    action: draft.action,
    reason: draft.reason,
    reviewer_name: draft.reviewerName,
  });
  if (error) fail("save bid decision", error);
}
