"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  EVIDENCE_MAX_BYTES,
  evidenceExtension,
  evidenceFileProblem,
  evidenceTypeFromBytes,
  evidenceTypeFromName,
  type EvidenceType,
} from "@/lib/company/files";
import {
  getDocumentForUpload,
  insertDocumentFile,
  insertOtherDocument,
  updateCompanyDocument,
} from "@/lib/db/queries/company";
import { EVIDENCE_BUCKET, getServiceClient } from "@/lib/db/supabase-server";
import { DOCUMENT_HOLDINGS } from "@/lib/db/vocab";

const inputSchema = z.object({
  id: z.uuid(),
  holding: z.enum(DOCUMENT_HOLDINGS),
  neverExpires: z.boolean(),
  expiresOn: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: "Enter a real expiry date." }),
});

const addSchema = z.object({
  requirement: z.string().trim().min(8).max(4000),
});

export type DocumentActionResult = { ok: true } | { ok: false; error: string };

export async function saveCompanyDocument(input: unknown): Promise<DocumentActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the status and the date." };
  try {
    const expiresOn = parsed.data.neverExpires ? null : parsed.data.expiresOn || null;
    await updateCompanyDocument(parsed.data.id, parsed.data.holding, expiresOn, parsed.data.neverExpires);
    revalidatePath("/evidence");
    revalidatePath("/company");
    revalidatePath("/");
    revalidatePath("/tenders", "layout");
    return { ok: true };
  } catch (error) {
    console.error("save company document", error);
    return { ok: false, error: "The status could not be saved. Please try again." };
  }
}

/** Adds a tender line that is not on the company list. Readiness runs again on the next render. */
export async function addRequirementDocument(input: unknown): Promise<DocumentActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That requirement could not be added." };
  try {
    await insertOtherDocument(parsed.data.requirement);
    revalidatePath("/evidence");
    revalidatePath("/company");
    revalidatePath("/");
    revalidatePath("/tenders", "layout");
    return { ok: true };
  } catch (error) {
    console.error("add company document", error);
    return { ok: false, error: "The document could not be added. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Evidence file upload: the same two steps as a tender PDF. The browser sends the file straight to private
// Storage with a one-time link, then the server checks the real bytes before it records anything.
// ---------------------------------------------------------------------------

export type FileActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const prepareSchema = z.object({
  id: z.uuid(),
  fileName: z.string().min(1).max(255),
  size: z.number().int(),
});

const registerSchema = z.object({
  id: z.uuid(),
  path: z.string().regex(/^documents\/[0-9a-f-]{36}\.(pdf|png|jpg)$/),
  originalName: z.string().min(1).max(255),
});

function revalidateEvidence() {
  revalidatePath("/evidence");
  revalidatePath("/company");
  revalidatePath("/");
  revalidatePath("/tenders", "layout");
}

/** Step 1: check the file name and size, then issue a one-time signed upload link. */
export async function prepareDocumentUpload(
  input: unknown,
): Promise<FileActionResult<{ path: string; token: string; contentType: EvidenceType }>> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That file could not be read." };
  const problem = evidenceFileProblem({ name: parsed.data.fileName, size: parsed.data.size });
  const type = evidenceTypeFromName(parsed.data.fileName);
  if (problem || !type) return { ok: false, error: problem ?? "Upload a PDF, PNG or JPG file." };
  try {
    if (!(await getDocumentForUpload(parsed.data.id))) {
      return { ok: false, error: "That paper is not on the company checklist." };
    }
    // The stored name is random. The person's file name is kept in document_files.original_name.
    const path = `documents/${randomUUID()}.${evidenceExtension(type)}`;
    const { data, error } = await getServiceClient().storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("no signed upload URL");
    return { ok: true, data: { path, token: data.token, contentType: type } };
  } catch (error) {
    console.error("prepare document upload", error);
    return { ok: false, error: "The upload could not start. Please try again." };
  }
}

/** Step 2: after the browser uploaded the file, check what it really is, then record it. */
export async function registerDocumentUpload(
  input: unknown,
): Promise<FileActionResult<{ becameHave: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That file could not be read." };
  const { id, path, originalName } = parsed.data;
  const bucket = getServiceClient().storage.from(EVIDENCE_BUCKET);
  const discard = () => bucket.remove([path]).catch(() => undefined);

  try {
    const { data: blob, error } = await bucket.download(path);
    if (error || !blob) return { ok: false, error: "The upload did not arrive. Please try again." };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const type = evidenceTypeFromBytes(bytes);
    if (bytes.length > EVIDENCE_MAX_BYTES || !type || evidenceExtension(type) !== path.split(".").pop()) {
      await discard();
      return { ok: false, error: "This file is not a valid PDF, PNG or JPG (or is too large)." };
    }
    const result = await insertDocumentFile({
      capabilityId: id,
      storagePath: path,
      originalName,
      mimeType: type,
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    revalidateEvidence();
    return { ok: true, data: result };
  } catch (error) {
    console.error("register document upload", error);
    await discard();
    return { ok: false, error: "The file could not be saved. Please try again." };
  }
}
