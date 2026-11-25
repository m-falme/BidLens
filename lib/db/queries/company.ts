import "server-only";

import { cache } from "react";

import { currentFiles } from "@/lib/company/files";
import { sameName, TEAM_EVIDENCE_REF, type ProfileKind } from "@/lib/company/profile";
import { ADDED_FROM_TENDER_REF, COMPANY_PAPERS, documentNameFromRequirement, type DocumentHolding, type PaperGroup } from "@/lib/company/papers";
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
  /** The registered name before the first edit. Null until someone changes it. */
  originalLegalName: string | null;
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

  const originalLegalName =
    profile && typeof profile === "object" && !Array.isArray(profile) && typeof profile.legal_name_original === "string"
      ? profile.legal_name_original
      : null;

  return { name: company.name, legalName, originalLegalName, documents };
}

export type CapabilityKind = "service" | "tool" | "sector";

export interface CompanyCapability {
  id: string;
  name: string;
  kind: CapabilityKind;
  /** Added by the team. Not stated in the company profile document, and not checked. */
  addedByTeam: boolean;
}

/** Services, tools and sectors stated in the company profile. Read-only on screen. */
export async function listCompanyCapabilities(): Promise<CompanyCapability[]> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("capabilities")
    .select("id, name, kind, verified")
    .eq("company_id", companyId)
    .in("kind", ["service", "tool", "sector"])
    .order("name");
  if (error) fail("load capabilities", error);
  return data.flatMap((row) =>
    row.kind === "service" || row.kind === "tool" || row.kind === "sector"
      ? [{ id: row.id, name: row.name, kind: row.kind, addedByTeam: !row.verified }]
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
    evidence_ref: ADDED_FROM_TENDER_REF,
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

interface FileRow {
  id: string;
  capabilityId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * The files that still count, newest first: those uploaded after a paper's latest removal. Throws if the file
 * list cannot be read. The removals table arrived in a later migration, so if it is missing nothing counts as removed.
 */
async function loadCurrentFileRows(capabilityIds?: readonly string[]): Promise<FileRow[]> {
  const db = getServiceClient();
  const filesQuery = db
    .from("document_files")
    .select("id, capability_id, storage_path, original_name, mime_type, size_bytes, created_at");
  const removalsQuery = db.from("document_file_removals").select("capability_id, created_at");
  const [files, removals] = await Promise.all([
    capabilityIds ? filesQuery.in("capability_id", [...capabilityIds]) : filesQuery,
    capabilityIds ? removalsQuery.in("capability_id", [...capabilityIds]) : removalsQuery,
  ]);
  if (files.error) throw new Error(files.error.message);
  if (removals.error) console.error("load document file removals", removals.error);
  return currentFiles(
    files.data.map((row) => ({
      id: row.id,
      capabilityId: row.capability_id,
      storagePath: row.storage_path,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
    })),
    (removals.data ?? []).map((row) => ({ capabilityId: row.capability_id, createdAt: row.created_at })),
  );
}

/**
 * Newest current file per document, with a signed link. A read that fails (for example before a migration is
 * applied) means "no files": the Evidence library still opens.
 */
async function listDocumentFiles(capabilityIds: readonly string[]): Promise<Map<string, DocumentFile>> {
  const result = new Map<string, DocumentFile>();
  if (capabilityIds.length === 0) return result;
  try {
    const rows = await loadCurrentFileRows(capabilityIds);
    const newest = new Map<string, FileRow>();
    const versions = new Map<string, number>();
    for (const row of rows) {
      versions.set(row.capabilityId, (versions.get(row.capabilityId) ?? 0) + 1);
      if (!newest.has(row.capabilityId)) newest.set(row.capabilityId, row);
    }

    const signed = await getServiceClient()
      .storage.from(EVIDENCE_BUCKET)
      .createSignedUrls([...newest.values()].map((row) => row.storagePath), 60 * 60);
    const urls = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl]));

    for (const [capabilityId, row] of newest) {
      result.set(capabilityId, {
        id: row.id,
        name: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        uploadedAt: row.createdAt,
        url: urls.get(row.storagePath) ?? null,
        versions: versions.get(capabilityId) ?? 1,
      });
    }
  } catch (error) {
    console.error("load document files", error);
  }
  return result;
}

async function documentHasFile(capabilityId: string): Promise<boolean> {
  try {
    return (await loadCurrentFileRows([capabilityId])).length > 0;
  } catch (error) {
    console.error("count document files", error);
    return false;
  }
}

/** Ids of company papers that have a current file. Empty when the table is not there yet. */
export async function listDocumentIdsWithFiles(): Promise<Set<string>> {
  try {
    return new Set((await loadCurrentFileRows()).map((row) => row.capabilityId));
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

/**
 * Removes the paper's file from view. Nothing is deleted: the file stays in Storage and in the history, and a
 * removal row records when. A Have that no longer has a file goes back to self-declared.
 */
export async function removeDocumentFile(capabilityId: string): Promise<void> {
  const document = await getDocumentForUpload(capabilityId);
  if (!document) throw new Error("That paper is not on the company checklist.");
  if (!(await documentHasFile(capabilityId))) throw new Error("There is no file to remove.");
  const db = getServiceClient();

  const { error } = await db.from("document_file_removals").insert({ capability_id: capabilityId });
  if (error) fail("remove document file", error);

  const { data: row, error: loadError } = await db
    .from("capabilities")
    .select("holding, verified")
    .eq("id", capabilityId)
    .single();
  if (loadError) fail("load document status", loadError);
  if (row.holding === "have") {
    const { error: updateError } = await db
      .from("capabilities")
      .update({ self_declared: !row.verified })
      .eq("id", capabilityId);
    if (updateError) fail("update document status", updateError);
  }
}

// ---------------------------------------------------------------------------
// Editing "Your company profile"
// ---------------------------------------------------------------------------

/** The registered name. The workspace name is fixed because the app finds the company by it. */
export async function updateLegalName(name: string): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data, error } = await db.from("companies").select("profile_json").eq("id", companyId).single();
  if (error) fail("load company", error);
  const current =
    data.profile_json && typeof data.profile_json === "object" && !Array.isArray(data.profile_json)
      ? { ...data.profile_json }
      : {};
  // The first edit keeps the original, the way a changed document status does.
  if (typeof current.legal_name === "string" && typeof current.legal_name_original !== "string") {
    current.legal_name_original = current.legal_name;
  }
  current.legal_name = name;
  const { error: updateError } = await db
    .from("companies")
    .update({ profile_json: current, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (updateError) fail("save registered name", updateError);
}

/**
 * Adds a service, tool or sector the team states. It is the team's own claim: not verified, and a tender line
 * matched to it reads "Claimed, not verified".
 */
export async function addCompanyCapability(kind: ProfileKind, name: string): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: existing, error: loadError } = await db
    .from("capabilities")
    .select("name")
    .eq("company_id", companyId)
    .eq("kind", kind);
  if (loadError) fail("load capabilities", loadError);
  if (existing.some((row) => sameName(row.name, name))) throw new Error("That is already on your profile.");

  const { error } = await db.from("capabilities").insert({
    company_id: companyId,
    kind,
    name,
    detail: null,
    evidence_ref: TEAM_EVIDENCE_REF,
    verified: false,
    self_declared: true,
  });
  if (error) {
    if (error.code === "23505") throw new Error("That is already on your profile.");
    fail("add capability", error);
  }
}

/**
 * Removes something the team added. An item stated in the profile document cannot be removed here.
 * Readiness rows that matched it are computed output and are rebuilt the next time a tender opens, so they go with it.
 */
export async function removeCompanyCapability(id: string): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: row, error: loadError } = await db
    .from("capabilities")
    .select("id, kind, verified")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (loadError) fail("load capability", loadError);
  if (!row || !["service", "tool", "sector"].includes(row.kind)) throw new Error("That item was not found.");
  if (row.verified) throw new Error("This is stated in your company profile document, so it cannot be removed here.");

  const { error: unlinkError } = await db.from("requirements").delete().eq("capability_id", id);
  if (unlinkError) fail("clear linked readiness rows", unlinkError);
  const { error } = await db.from("capabilities").delete().eq("id", id);
  if (error) fail("remove capability", error);
}
