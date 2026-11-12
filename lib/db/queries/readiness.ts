import "server-only";

import type { MatchedRequirement, ProfileCapability } from "@/lib/readiness/match";

import type { CapabilityKind, DocumentHolding } from "../vocab";
import { getServiceClient } from "../supabase-server";
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
    .select("id, kind, name, detail, evidence_ref, holding, self_declared, expires_on")
    .eq("company_id", companyId);
  if (error) fail("load capabilities", error);
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
        expiresOn: row.expires_on,
      },
    ];
  });
}

/** Replaces the computed readiness rows. Human edits of requirements are not in this step. */
export async function replaceReadiness(
  opportunityId: string,
  items: readonly MatchedRequirement[],
  readinessPct: number,
): Promise<void> {
  const db = getServiceClient();
  const { error: deleteError } = await db.from("requirements").delete().eq("opportunity_id", opportunityId);
  if (deleteError) fail("clear readiness", deleteError);
  if (items.length > 0) {
    const { error } = await db.from("requirements").insert(
      items.map((item) => ({
        opportunity_id: opportunityId,
        text: item.text,
        category: item.category,
        page_no: item.pageNo,
        quote: item.quote,
        match: item.match,
        capability_id: item.capabilityId,
        rationale: item.rationale,
      })),
    );
    if (error) fail("save readiness", error);
  }
  const { error: updateError } = await db
    .from("opportunities")
    .update({ readiness_pct: readinessPct })
    .eq("id", opportunityId);
  if (updateError) fail("save readiness score", updateError);
}
