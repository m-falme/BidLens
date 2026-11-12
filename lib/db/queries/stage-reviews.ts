import "server-only";

import {
  REVIEW_STAGES,
  type ReviewStage,
  type StageReviewDraft,
  type StageReviewRecord,
} from "@/lib/tenders/stage-review";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function asStage(value: string): ReviewStage | null {
  return (REVIEW_STAGES as readonly string[]).includes(value) ? (value as ReviewStage) : null;
}

export async function listStageReviews(tenderId: string): Promise<StageReviewRecord[]> {
  const { data, error } = await getServiceClient()
    .from("stage_reviews")
    .select("stage, reviewer_name, note, created_at")
    .eq("tender_id", tenderId)
    .order("created_at", { ascending: true });
  if (error) fail("load stage reviews", error);
  return data.flatMap((row) => {
    const stage = asStage(row.stage);
    if (!stage) return [];
    return [{ stage, reviewerName: row.reviewer_name, note: row.note, createdAt: row.created_at }];
  });
}

/** Append one review. The tender must belong to the signed-in workspace. */
export async function insertStageReview(draft: StageReviewDraft): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: tender, error: tenderError } = await db
    .from("opportunities")
    .select("id")
    .eq("id", draft.tenderId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (tenderError) fail("load tender for review", tenderError);
  if (!tender) throw new Error("That tender was not found.");

  const { error } = await db.from("stage_reviews").insert({
    tender_id: draft.tenderId,
    stage: draft.stage,
    reviewer_name: draft.reviewerName,
    note: draft.note,
  });
  if (error) fail("save stage review", error);
}
