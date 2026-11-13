import "server-only";

import { DECISION_ACTIONS, type BidDecisionRecord } from "@/lib/recommendation/decision";
import { presentLeadCopy } from "@/lib/leads/public-names";
import { asRecommendationLabel } from "@/lib/recommendation/labels";
import { decisionTrail, type TrailEntry } from "@/lib/recommendation/trail";
import { REVIEW_STAGES, type StageReviewRecord } from "@/lib/tenders/stage-review";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export interface WorkspaceTrailEntry extends TrailEntry {
  tenderId: string;
  tenderTitle: string;
}

export interface WorkspaceTrail {
  entries: WorkspaceTrailEntry[];
  tenders: { id: string; title: string }[];
}

/** Every stage review and bid decision for this workspace, newest first. Two queries, no per-tender loop. */
export async function loadWorkspaceTrail(): Promise<WorkspaceTrail> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const [reviews, decisions] = await Promise.all([
    db
      .from("stage_reviews")
      .select("tender_id, stage, reviewer_name, note, created_at, opportunities!inner(title, company_id)")
      .eq("opportunities.company_id", companyId),
    db
      .from("bid_decisions")
      .select(
        "tender_id, recommended_label, final_label, action, reason, reviewer_name, created_at, opportunities!inner(title, company_id)",
      )
      .eq("opportunities.company_id", companyId),
  ]);
  if (reviews.error) fail("load stage reviews", reviews.error);
  if (decisions.error) fail("load bid decisions", decisions.error);

  const titles = new Map<string, string>();
  const byTender = new Map<string, { reviews: StageReviewRecord[]; decisions: BidDecisionRecord[] }>();
  const bucket = (id: string) => {
    const existing = byTender.get(id);
    if (existing) return existing;
    const created = { reviews: [], decisions: [] };
    byTender.set(id, created);
    return created;
  };
  const titleOf = (joined: { title: string } | { title: string }[] | null) =>
    presentLeadCopy((Array.isArray(joined) ? joined[0]?.title : joined?.title) ?? null) ?? "Untitled tender";

  for (const row of reviews.data) {
    const stage = REVIEW_STAGES.find((value) => value === row.stage);
    if (!stage) continue;
    titles.set(row.tender_id, titleOf(row.opportunities));
    bucket(row.tender_id).reviews.push({
      stage,
      reviewerName: row.reviewer_name,
      note: row.note,
      createdAt: row.created_at,
    });
  }
  for (const row of decisions.data) {
    const recommendedLabel = asRecommendationLabel(row.recommended_label);
    const finalLabel = asRecommendationLabel(row.final_label);
    const action = DECISION_ACTIONS.find((value) => value === row.action);
    if (!recommendedLabel || !finalLabel || !action) continue;
    titles.set(row.tender_id, titleOf(row.opportunities));
    bucket(row.tender_id).decisions.push({
      recommendedLabel,
      finalLabel,
      action,
      reason: row.reason,
      reviewerName: row.reviewer_name,
      createdAt: row.created_at,
    });
  }

  const entries: WorkspaceTrailEntry[] = [];
  for (const [tenderId, rows] of byTender) {
    const tenderTitle = titles.get(tenderId) ?? "Untitled tender";
    for (const entry of decisionTrail(rows.reviews, rows.decisions)) {
      entries.push({ ...entry, tenderId, tenderTitle });
    }
  }
  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const tenders = [...titles].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  return { entries, tenders };
}
