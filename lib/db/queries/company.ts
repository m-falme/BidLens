import "server-only";

import { cache } from "react";

import { COMPANY_PAPERS, documentNameFromRequirement, type DocumentHolding, type PaperGroup } from "@/lib/company/papers";
import { DOCUMENT_HOLDINGS } from "@/lib/db/vocab";

import { getServiceClient, EVIDENCE_BUCKET } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export interface DocumentUse {
  tenderId: string;
  tenderTitle: string;
  requirement: string;
}

/** The newest file uploaded for a document. Earlier files are kept and counted in `versions`. */
export interface DocumentFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Short-lived link to open the file. Null if it could not be signed. */
  url: string | null;
  versions: number;
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
  /** Null until someone uploads a file. */
  file: DocumentFile | null;
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
  const files = await listDocumentFiles(data.map((row) => row.id));

  const byName = new Map(data.map((row) => [row.name, row]));
  const listed = new Set(COMPANY_PAPERS.map((paper) => paper.name));
  const fromCatalog = COMPANY_PAPERS.flatMap((paper) => {
    const row = byName.get(paper.name);
    const holding = asHolding(row?.holding ?? null);
    if (!row || !holding) return [];
    return [toDocument(row, paper.group, uses.get(row.id) ?? [], files.get(row.id) ?? null)];
  });
  const other = data.flatMap((row) => {
    if (listed.has(row.name)) return [];
    const holding = asHolding(row.holding);
    if (!holding) return [];
    return [toDocument(row, "other", uses.get(row.id) ?? [], files.get(row.id) ?? null)];
  });
  const documents = [...fromCatalog, ...other];

  const profile = company.profile_json;
  const legalName =
    profile && typeof profile === "object" && !Array.isArray(profile) && typeof profile.legal_name === "string"
      ? profile.legal_name
      : null;

  return { name: company.name, legalName, documents };
}

export type CapabilityKind = "service" | "tool" | "sector";

export interface CompanyCapability {
  id: string;
  name: string;
  kind: CapabilityKind;
}

/** Services, tools and sectors stated in the company profile. Read-only on screen. */
export async function listCompanyCapabilities(): Promise<CompanyCapability[]> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("capabilities")
    .select("id, name, kind")
    .eq("company_id", companyId)
    .in("kind", ["service", "tool", "sector"])
    .order("name");
  if (error) fail("load capabilities", error);
  return data.flatMap((row) =>
    row.kind === "service" || row.kind === "tool" || row.kind === "sector"
      ? [{ id: row.id, name: row.name, kind: row.kind }]
      : [],
  );
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

function toDocument(
  row: DocumentRow,
  group: PaperGroup,
  uses: DocumentUse[],
  file: DocumentFile | null,
): CompanyDocument {
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
    file,
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
      self_declared: holding === "have" ? !(row.verified || (await documentHasFile(id))) : false,
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

// ---------------------------------------------------------------------------
// Evidence files
// ---------------------------------------------------------------------------

/**
 * Newest file per document, with a signed link. A read that fails (for example before the migration is
 * applied) means "no files": the Evidence library still opens.
 */
async function listDocumentFiles(capabilityIds: readonly string[]): Promise<Map<string, DocumentFile>> {
  const result = new Map<string, DocumentFile>();
  if (capabilityIds.length === 0) return result;
  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from("document_files")
      .select("id, capability_id, storage_path, original_name, mime_type, size_bytes, created_at")
      .in("capability_id", [...capabilityIds])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const newest = new Map<string, (typeof data)[number]>();
    const versions = new Map<string, number>();
    for (const row of data) {
      versions.set(row.capability_id, (versions.get(row.capability_id) ?? 0) + 1);
      if (!newest.has(row.capability_id)) newest.set(row.capability_id, row);
    }

    const signed = await db.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrls([...newest.values()].map((row) => row.storage_path), 60 * 60);
    const urls = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl]));

    for (const [capabilityId, row] of newest) {
      result.set(capabilityId, {
        id: row.id,
        name: row.original_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        uploadedAt: row.created_at,
        url: urls.get(row.storage_path) ?? null,
        versions: versions.get(capabilityId) ?? 1,
      });
    }
  } catch (error) {
    console.error("load document files", error);
  }
  return result;
}

async function documentHasFile(capabilityId: string): Promise<boolean> {
  const { count, error } = await getServiceClient()
    .from("document_files")
    .select("id", { count: "exact", head: true })
    .eq("capability_id", capabilityId);
  if (error) {
    console.error("count document files", error);
    return false;
  }
  return (count ?? 0) > 0;
}

/** Ids of company papers that have at least one uploaded file. Empty when the table is not there yet. */
export async function listDocumentIdsWithFiles(): Promise<Set<string>> {
  try {
    const { data, error } = await getServiceClient().from("document_files").select("capability_id");
    if (error) throw new Error(error.message);
    return new Set(data.map((row) => row.capability_id));
  } catch (error) {
    console.error("list document files", error);
    return new Set();
  }
}

/** The paper must be on this company's checklist. Null if it is not. */
export async function getDocumentForUpload(id: string): Promise<{ id: string; name: string } | null> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("capabilities")
    .select("id, name, kind")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) fail("load document", error);
  if (!data || (data.kind !== "document" && data.kind !== "certification")) return null;
  return { id: data.id, name: data.name };
}

export interface DocumentFileDraft {
  capabilityId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * Records the file and moves the paper forward: Don't have becomes Have, and a Have is no longer only
 * self-declared. An Expired paper stays Expired, because a file does not renew it.
 * Returns whether the status changed to Have.
 */
export async function insertDocumentFile(draft: DocumentFileDraft): Promise<{ becameHave: boolean }> {
  const document = await getDocumentForUpload(draft.capabilityId);
  if (!document) throw new Error("That paper is not on the company checklist.");
  const db = getServiceClient();

  const { error } = await db.from("document_files").insert({
    capability_id: draft.capabilityId,
    storage_path: draft.storagePath,
    original_name: draft.originalName,
    mime_type: draft.mimeType,
    size_bytes: draft.sizeBytes,
    sha256: draft.sha256,
  });
  if (error) fail("save document file", error);

  const { data: row, error: loadError } = await db
    .from("capabilities")
    .select("holding")
    .eq("id", draft.capabilityId)
    .single();
  if (loadError) fail("load document status", loadError);
  const becameHave = row.holding === "dont_have";
  const holding = becameHave ? "have" : row.holding;
  const { error: updateError } = await db
    .from("capabilities")
    .update({ holding, self_declared: holding === "have" ? false : undefined })
    .eq("id", draft.capabilityId);
  if (updateError) fail("update document status", updateError);
  return { becameHave };
}
