import "server-only";

import { cache } from "react";

import { COMPANY_PAPERS, documentNameFromRequirement, type DocumentHolding, type PaperGroup } from "@/lib/company/papers";
import { DOCUMENT_HOLDINGS } from "@/lib/db/vocab";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export interface DocumentUse {
  tenderId: string;
  tenderTitle: string;
  requirement: string;
}

export interface CompanyDocument {
  id: string;
  name: string;
  group: PaperGroup;
  holding: DocumentHolding;
  selfDeclared: boolean;
  expiresOn: string | null;
  /** Ticked "Does not expire". No date is stored. */
  neverExpires: boolean;
  /** The status before the first edit. Null until someone changes it. */
  originalHolding: DocumentHolding | null;
  /** Requirements this paper satisfied (match met), across tenders. */
  uses: DocumentUse[];
}

export interface CompanyProfile {
  name: string;
  legalName: string | null;
  documents: CompanyDocument[];
}

const HOLDINGS = new Set<string>(DOCUMENT_HOLDINGS);

function asHolding(value: string | null): DocumentHolding | null {
  return value && HOLDINGS.has(value) ? (value as DocumentHolding) : null;
}

/** The signed-in organisation. Read from the company row, not written into the brand. */
export const getWorkspaceName = cache(async function getWorkspaceName(): Promise<string> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient().from("companies").select("name").eq("id", companyId).single();
  if (error || !data) fail("load workspace", error);
  return data.name;
});

export async function getDemoCompanyProfile(): Promise<CompanyProfile> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: company, error } = await db
    .from("companies")
    .select("name, profile_json")
    .eq("id", companyId)
    .single();
  if (error) fail("load company", error);

  const [{ data, error: docsError }, uses] = await Promise.all([
    db
      .from("capabilities")
      .select("id, name, kind, holding, self_declared, expires_on, never_expires, original_holding")
      .eq("company_id", companyId)
      .in("kind", ["document", "certification"]),
    listDocumentUses(companyId),
  ]);
  if (docsError) fail("load company documents", docsError);

  const byName = new Map(data.map((row) => [row.name, row]));
  const listed = new Set(COMPANY_PAPERS.map((paper) => paper.name));
  const fromCatalog = COMPANY_PAPERS.flatMap((paper) => {
    const row = byName.get(paper.name);
    const holding = asHolding(row?.holding ?? null);
    if (!row || !holding) return [];
    return [toDocument(row, paper.group, uses.get(row.id) ?? [])];
  });
  const other = data.flatMap((row) => {
    if (listed.has(row.name)) return [];
    const holding = asHolding(row.holding);
    if (!holding) return [];
    return [toDocument(row, "other", uses.get(row.id) ?? [])];
  });
  const documents = [...fromCatalog, ...other];

  const profile = company.profile_json;
  const legalName =
    profile && typeof profile === "object" && !Array.isArray(profile) && typeof profile.legal_name === "string"
      ? profile.legal_name
      : null;

  return { name: company.name, legalName, documents };
}

type DocumentRow = {
  id: string;
  name: string;
  holding: string | null;
  self_declared: boolean;
  expires_on: string | null;
  never_expires: boolean;
  original_holding: string | null;
};

function toDocument(row: DocumentRow, group: PaperGroup, uses: DocumentUse[]): CompanyDocument {
  const holding = asHolding(row.holding);
  if (!holding) throw new Error("toDocument requires a holding");
  return {
    id: row.id,
    name: row.name,
    group,
    holding,
    selfDeclared: row.self_declared,
    expiresOn: row.expires_on,
    neverExpires: row.never_expires,
    originalHolding: asHolding(row.original_holding),
    uses,
  };
}

async function listDocumentUses(companyId: string): Promise<Map<string, DocumentUse[]>> {
  const { data, error } = await getServiceClient()
    .from("requirements")
    .select("capability_id, text, opportunities!inner(id, title, company_id)")
    .eq("match", "met")
    .eq("opportunities.company_id", companyId);
  if (error) fail("load document use", error);
  const uses = new Map<string, DocumentUse[]>();
  const seen = new Set<string>();
  for (const row of data) {
    if (!row.capability_id) continue;
    const tender = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    if (!tender) continue;
    const key = `${row.capability_id}:${tender.id}:${row.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = uses.get(row.capability_id) ?? [];
    list.push({ tenderId: tender.id, tenderTitle: tender.title, requirement: row.text });
    uses.set(row.capability_id, list);
  }
  return uses;
}

/** The team sets Have / Don't have / Expired. The previous status is kept by the database. */
export async function updateCompanyDocument(
  id: string,
  holding: DocumentHolding,
  expiresOn: string | null,
  neverExpires: boolean,
): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: row, error: loadError } = await db
    .from("capabilities")
    .select("id, verified, kind")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (loadError) fail("load document", loadError);
  if (!row || (row.kind !== "document" && row.kind !== "certification")) {
    throw new Error("That paper is not on the company checklist.");
  }

  const { error } = await db
    .from("capabilities")
    .update({
      holding,
      never_expires: neverExpires,
      expires_on: holding === "dont_have" || neverExpires ? null : expiresOn,
      // A Have with no checked file stays a self-declaration.
      self_declared: holding === "have" ? !row.verified : false,
    })
    .eq("id", id);
  if (error) fail("save document", error);
}

/** Adds a tender requirement that is not on the checklist yet. Status is Don't have. */
export async function insertOtherDocument(requirement: string): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const name = documentNameFromRequirement(requirement);
  const { data: existing, error: loadError } = await db
    .from("capabilities")
    .select("id")
    .eq("company_id", companyId)
    .eq("kind", "document")
    .eq("name", name)
    .maybeSingle();
  if (loadError) fail("load document", loadError);
  if (existing) return;

  const { error } = await db.from("capabilities").insert({
    company_id: companyId,
    kind: "document",
    name,
    detail: requirement.replace(/\s+/g, " ").trim(),
    evidence_ref: "Added from a tender requirement",
    verified: false,
    holding: "dont_have",
    expires_on: null,
    self_declared: false,
    never_expires: false,
  });
  if (error) {
    if (error.code === "23505") return;
    fail("add document", error);
  }
}
