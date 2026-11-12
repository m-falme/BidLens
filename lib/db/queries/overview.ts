import "server-only";

import { isDocumentToGet } from "@/lib/plan/build";
import { asRecommendationLabel, type RecommendationLabel } from "@/lib/recommendation/labels";
import { summarizeReview, type ReviewField } from "@/lib/tenders/review";
import { REVIEW_STAGES, type ReviewStage } from "@/lib/tenders/stage-review";
import type { OverviewTender } from "@/lib/overview/build";

import { FIELD_STATUSES, type FieldStatus } from "../vocab";
import { getServiceClient } from "../supabase-server";
import { getDemoCompanyProfile } from "./company";
import { listTenders } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function asStage(value: string): ReviewStage | null {
  return (REVIEW_STAGES as readonly string[]).includes(value) ? (value as ReviewStage) : null;
}

function asFieldStatus(value: string): FieldStatus | null {
  return (FIELD_STATUSES as readonly string[]).includes(value) ? (value as FieldStatus) : null;
}

export interface OverviewActivitySource {
  reviews: { tenderId: string; stage: ReviewStage; reviewerName: string; createdAt: string }[];
  decisions: {
    tenderId: string;
    action: "approve" | "override";
    finalLabel: RecommendationLabel;
    reviewerName: string;
    createdAt: string;
  }[];
  titles: Map<string, string>;
}

export interface OverviewSnapshot {
  companyName: string;
  uploaded: OverviewTender[];
  documents: { holding: string; expiresOn: string | null; neverExpires: boolean }[];
  activity: OverviewActivitySource;
}

/** Uploaded tenders, document holdings, and the trail. Leads are left out. */
export async function loadOverview(): Promise<OverviewSnapshot> {
  const db = getServiceClient();
  const [tenders, profile, reviews, decisions] = await Promise.all([
    listTenders(),
    getDemoCompanyProfile(),
    db.from("stage_reviews").select("tender_id, stage, reviewer_name, created_at"),
    db
      .from("bid_decisions")
      .select("tender_id, final_label, action, reviewer_name, created_at"),
  ]);
  if (reviews.error) fail("load stage reviews", reviews.error);
  if (decisions.error) fail("load bid decisions", decisions.error);

  const uploadedIds = tenders.filter((tender) => tender.pdfSources > 0).map((tender) => tender.id);
  const reviewed = new Map<string, Set<ReviewStage>>();
  for (const row of reviews.data) {
    const stage = asStage(row.stage);
    if (!stage) continue;
    const set = reviewed.get(row.tender_id) ?? new Set<ReviewStage>();
    set.add(stage);
    reviewed.set(row.tender_id, set);
  }

  const [missingByTender, conflictsByTender] = await Promise.all([
    countMissingMandatory(uploadedIds),
    countAddendumConflicts(tenders.filter((tender) => tender.pdfSources > 0 && tender.addenda > 0).map((tender) => tender.id)),
  ]);

  const titles = new Map(tenders.map((tender) => [tender.id, tender.title]));
  const uploaded: OverviewTender[] = tenders
    .filter((tender) => tender.pdfSources > 0)
    .map((tender) => ({
      id: tender.id,
      title: tender.title,
      buyer: tender.organization,
      reference: tender.reference,
      closing: tender.closing,
      deadlineAt: tender.deadlineAt,
      needsHuman: tender.needsHuman,
      missingMandatory: missingByTender.get(tender.id) ?? 0,
      addendumConflicts: conflictsByTender.get(tender.id) ?? 0,
      finalLabel: tender.finalLabel,
      reviewedStages: [...(reviewed.get(tender.id) ?? [])],
    }));

  return {
    companyName: profile.name,
    uploaded,
    documents: profile.documents.map((document) => ({
      holding: document.holding,
      expiresOn: document.expiresOn,
      neverExpires: document.neverExpires,
    })),
    activity: {
      titles,
      reviews: reviews.data.flatMap((row) => {
        const stage = asStage(row.stage);
        if (!stage) return [];
        return [{ tenderId: row.tender_id, stage, reviewerName: row.reviewer_name, createdAt: row.created_at }];
      }),
      decisions: decisions.data.flatMap((row) => {
        const finalLabel = asRecommendationLabel(row.final_label);
        if (!finalLabel) return [];
        if (row.action !== "approve" && row.action !== "override") return [];
        return [
          {
            tenderId: row.tender_id,
            action: row.action,
            finalLabel,
            reviewerName: row.reviewer_name,
            createdAt: row.created_at,
          },
        ];
      }),
    },
  };
}

async function countMissingMandatory(tenderIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (tenderIds.length === 0) return counts;
  const { data, error } = await getServiceClient()
    .from("requirements")
    .select("opportunity_id, text, match, category")
    .in("opportunity_id", [...tenderIds])
    .eq("match", "missing")
    .eq("category", "mandatory");
  if (error) fail("load missing documents", error);
  for (const row of data) {
    if (!isDocumentToGet(row)) continue;
    counts.set(row.opportunity_id, (counts.get(row.opportunity_id) ?? 0) + 1);
  }
  return counts;
}

async function countAddendumConflicts(tenderIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (tenderIds.length === 0) return counts;
  const db = getServiceClient();
  const [sources, fields] = await Promise.all([
    db.from("sources").select("id, opportunity_id, role").in("opportunity_id", [...tenderIds]),
    db
      .from("fields")
      .select("id, opportunity_id, source_id, key, value, quote, page_no, status, affects_key")
      .in("opportunity_id", [...tenderIds]),
  ]);
  if (sources.error) fail("load addendum sources", sources.error);
  if (fields.error) fail("load addendum fields", fields.error);

  for (const tenderId of tenderIds) {
    const roles = new Map<string, "main" | "addendum">();
    for (const source of sources.data) {
      if (source.opportunity_id !== tenderId) continue;
      if (source.role === "main" || source.role === "addendum") roles.set(source.id, source.role);
    }
    const reviewFields: ReviewField[] = [];
    for (const field of fields.data) {
      if (field.opportunity_id !== tenderId || !field.source_id) continue;
      const status = asFieldStatus(field.status);
      if (!status) continue;
      reviewFields.push({
        id: field.id,
        key: field.key,
        value: field.value,
        quote: field.quote,
        page_no: field.page_no,
        status,
        affects_key: field.affects_key,
        source_id: field.source_id,
      });
    }
    counts.set(tenderId, summarizeReview(reviewFields, roles).conflicts.length);
  }
  return counts;
}
