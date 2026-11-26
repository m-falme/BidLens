import "server-only";

import type { MatchedRequirement, ProfileCapability } from "@/lib/readiness/match";
import { readinessUnchanged, type StoredRequirementRow } from "@/lib/readiness/stored";

import type { CapabilityKind, DocumentHolding } from "../vocab";
import { getServiceClient } from "../supabase-server";
import { listDocumentIdsWithFiles } from "./company";
import { getDemoCompanyId } from "./tenders";

const CAPABILITY_KINDS = new Set<string>(["service", "tool", "document", "certification", "experience", "sector"]);
const HOLDINGS = new Set<string>(["have", "dont_have", "expired"]);

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function listDemoCapabilities(): Promise<ProfileCapability[]> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("capabilities")
    .select("id, kind, name, detail, evidence_ref, holding, self_declared, expires_on, never_expires")
    .eq("company_id", companyId);
  if (error) fail("load capabilities", error);
  const withFiles = await listDocumentIdsWithFiles();
  return data.flatMap((row) => {
    if (!CAPABILITY_KINDS.has(row.kind)) return [];
    return [
      {
        id: row.id,
        kind: row.kind as CapabilityKind,
        name: row.name,
        detail: row.detail,
        evidenceRef: row.evidence_ref,
        holding: row.holding && HOLDINGS.has(row.holding) ? (row.holding as DocumentHolding) : null,
        selfDeclared: row.self_declared,
        hasFile: withFiles.has(row.id),
        expiresOn: row.expires_on,
        neverExpires: row.never_expires,
      },
    ];
  });
}

/**
 * Saves the computed readiness rows (a cache of what the tender page shows). Human edits of requirements are not in
 * this step.
 *
 * Writes nothing when the saved rows already match, so simply opening a tender page leaves the database alone.
 * When it does write, the new rows go in first and every older row is removed after, so two page loads at the same
 * moment (a prefetch and a click) end with one set of rows, not two.
 */
export async function replaceReadiness(
  opportunityId: string,
  items: readonly MatchedRequirement[],
  readinessPct: number,
): Promise<void> {
  const db = getServiceClient();
  const rows: StoredRequirementRow[] = items.map((item) => ({
    text: item.text,
    category: item.category,
    page_no: item.pageNo,
    quote: item.quote,
    match: item.match,
    capability_id: item.capabilityId,
    rationale: item.rationale,
  }));

  const [stored, opportunity] = await Promise.all([
    db
      .from("requirements")
      .select("text, category, page_no, quote, match, capability_id, rationale")
      .eq("opportunity_id", opportunityId),
    db.from("opportunities").select("readiness_pct").eq("id", opportunityId).maybeSingle(),
  ]);
  if (stored.error) fail("load saved readiness", stored.error);
  if (opportunity.error) fail("load readiness score", opportunity.error);
  const pctUnchanged = opportunity.data !== null && Number(opportunity.data.readiness_pct) === readinessPct;
  if (readinessUnchanged(stored.data, rows) && pctUnchanged) return;

  if (rows.length === 0) {
    const { error } = await db.from("requirements").delete().eq("opportunity_id", opportunityId);
    if (error) fail("clear readiness", error);
  } else {
    const { data: inserted, error } = await db
      .from("requirements")
      .insert(rows.map((row) => ({ ...row, opportunity_id: opportunityId })))
      .select("created_at")
      .limit(1);
    if (error) fail("save readiness", error);
    const batchAt = inserted[0]?.created_at;
    if (batchAt) {
      const { error: cleanError } = await db
        .from("requirements")
        .delete()
        .eq("opportunity_id", opportunityId)
        .lt("created_at", batchAt);
      if (cleanError) fail("clear older readiness", cleanError);
    }
  }
  if (!pctUnchanged) {
    const { error: updateError } = await db
      .from("opportunities")
      .update({ readiness_pct: readinessPct })
      .eq("id", opportunityId);
    if (updateError) fail("save readiness score", updateError);
  }
}
