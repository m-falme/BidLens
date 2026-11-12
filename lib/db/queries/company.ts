import "server-only";

import { COMPANY_PAPERS, type DocumentHolding } from "@/lib/company/papers";
import { DOCUMENT_HOLDINGS } from "@/lib/db/vocab";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export interface CompanyDocument {
  id: string;
  name: string;
  group: "registration" | "licence";
  holding: DocumentHolding;
  selfDeclared: boolean;
  expiresOn: string | null;
  /** The status before the first edit. Null until someone changes it. */
  originalHolding: DocumentHolding | null;
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
export async function getWorkspaceName(): Promise<string> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient().from("companies").select("name").eq("id", companyId).single();
  if (error || !data) fail("load workspace", error);
  return data.name;
}

export async function getDemoCompanyProfile(): Promise<CompanyProfile> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: company, error } = await db
    .from("companies")
    .select("name, profile_json")
    .eq("id", companyId)
    .single();
  if (error) fail("load company", error);

  const { data, error: docsError } = await db
    .from("capabilities")
    .select("id, name, kind, holding, self_declared, expires_on, original_holding")
    .eq("company_id", companyId)
    .in("kind", ["document", "certification"]);
  if (docsError) fail("load company documents", docsError);

  const byName = new Map(data.map((row) => [row.name, row]));
  const documents = COMPANY_PAPERS.flatMap((paper) => {
    const row = byName.get(paper.name);
    const holding = asHolding(row?.holding ?? null);
    if (!row || !holding) return [];
    return [
      {
        id: row.id,
        name: row.name,
        group: paper.group,
        holding,
        selfDeclared: row.self_declared,
        expiresOn: row.expires_on,
        originalHolding: asHolding(row.original_holding),
      },
    ];
  });

  const profile = company.profile_json;
  const legalName =
    profile && typeof profile === "object" && !Array.isArray(profile) && typeof profile.legal_name === "string"
      ? profile.legal_name
      : null;

  return { name: company.name, legalName, documents };
}

/** The team sets Have / Don't have / Expired. The previous status is kept by the database. */
export async function updateCompanyDocument(
  id: string,
  holding: DocumentHolding,
  expiresOn: string | null,
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
      expires_on: holding === "dont_have" ? null : expiresOn,
      // A Have with no checked file stays a self-declaration.
      self_declared: holding === "have" ? !row.verified : false,
    })
    .eq("id", id);
  if (error) fail("save document", error);
}
