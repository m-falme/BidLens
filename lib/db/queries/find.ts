import "server-only";

import { createHash } from "node:crypto";

import { SAMPLE_PLATFORM, type LeadDraft } from "@/lib/find/start";
import type { FindProfile } from "@/lib/find/checks";

import { getServiceClient } from "../supabase-server";
import { listCompanyCapabilities, getDemoCompanyProfile } from "./company";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/** Services, tools, sectors and the papers marked Have, for ranking. Read only. */
export async function loadFindProfile(): Promise<FindProfile> {
  const [capabilities, profile] = await Promise.all([listCompanyCapabilities(), getDemoCompanyProfile()]);
  const names = (kind: string) => capabilities.filter((c) => c.kind === kind).map((c) => c.name);
  return {
    services: names("service"),
    tools: names("tool"),
    sectors: names("sector"),
    heldPapers: profile.documents.filter((d) => d.holding === "have").map((d) => d.name),
  };
}

/** Lead ids already created from sample tenders, by reference. Read only. */
export async function listStartedSampleLeads(): Promise<Map<string, string>> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("opportunities")
    .select("id, reference")
    .eq("company_id", companyId)
    .eq("source_platform", SAMPLE_PLATFORM)
    .not("reference", "is", null);
  if (error) fail("list started tenders", error);
  return new Map(data.flatMap((row) => (row.reference ? [[row.reference, row.id] as const] : [])));
}

export async function findSampleLead(reference: string): Promise<string | null> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("opportunities")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_platform", SAMPLE_PLATFORM)
    .eq("reference", reference)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) fail("check for an existing lead", error);
  return data?.id ?? null;
}

/**
 * Creates the lead: one procurement opportunity with no PDF (so it shows under Leads and opens the lead summary),
 * one form source holding the notice text, and its fields with quotes. A failure removes what this call made.
 */
export async function createSampleLead(draft: LeadDraft): Promise<string> {
  const db = getServiceClient();
  const companyId = await getDemoCompanyId();

  const { data: opportunity, error } = await db
    .from("opportunities")
    .insert({
      company_id: companyId,
      type: "procurement",
      title: draft.title,
      organization: draft.organization,
      location: draft.location,
      sector: draft.sector,
      reference: draft.reference,
      deadline_at: draft.deadlineAt,
      submission_method: draft.submissionMethod,
      source_platform: SAMPLE_PLATFORM,
      buyer_county: draft.buyerCounty,
      status: "new",
    })
    .select("id")
    .single();
  if (error) fail("create lead", error);

  const undo = async () => {
    await db.from("fields").delete().eq("opportunity_id", opportunity.id);
    await db.from("source_pages").delete().eq("source_id", sourceId);
    await db.from("sources").delete().eq("opportunity_id", opportunity.id);
    await db.from("opportunities").delete().eq("id", opportunity.id);
  };
  let sourceId = "";

  const { data: source, error: sourceError } = await db
    .from("sources")
    .insert({
      opportunity_id: opportunity.id,
      kind: "form",
      role: "main",
      original_name: `sample-tenders/tenders.json (${draft.reference})`,
      sha256: createHash("sha256").update(draft.pageText).digest("hex"),
      raw_text: draft.pageText,
    })
    .select("id")
    .single();
  if (sourceError) {
    await undo();
    fail("save lead source", sourceError);
  }
  sourceId = source.id;

  const { error: pageError } = await db
    .from("source_pages")
    .insert({ source_id: sourceId, page_no: 1, text: draft.pageText, is_scanned: false });
  if (pageError) {
    await undo();
    fail("save lead page", pageError);
  }

  const { error: fieldsError } = await db.from("fields").insert(
    draft.fields.map((field) => ({
      opportunity_id: opportunity.id,
      key: field.key,
      value: field.value,
      source_id: sourceId,
      page_no: 1,
      quote: field.quote,
      confidence: 1,
      status: field.status,
    })),
  );
  if (fieldsError) {
    await undo();
    fail("save lead fields", fieldsError);
  }
  return opportunity.id;
}
