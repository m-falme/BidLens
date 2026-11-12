"use server";

import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  createPdfSource,
  findSourceBySha256,
  getOpportunityForAddendum,
} from "@/lib/db/queries/tenders";
import { getServiceClient, SOURCES_BUCKET } from "@/lib/db/supabase-server";
import { SOURCE_ROLES } from "@/lib/db/vocab";
import { isPdfBytes, MAX_PDF_BYTES, parsePdfPages } from "@/lib/pdf/parse";

const uploadTarget = z
  .object({
    role: z.enum(SOURCE_ROLES),
    opportunityId: z.uuid().nullable(),
  })
  .refine((v) => v.role === "main" || v.opportunityId !== null, {
    message: "Choose the tender this addendum belongs to.",
  });

const prepareInput = uploadTarget.and(
  z.object({
    fileName: z
      .string()
      .min(1)
      .max(255)
      .refine((n) => /\.pdf$/i.test(n), { message: "Only PDF files can be uploaded." }),
    size: z
      .number()
      .int()
      .positive({ message: "The file is empty." })
      .max(MAX_PDF_BYTES, { message: `The file is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB.` }),
    // Some browsers send an empty type for PDFs; the bytes are checked after upload either way.
    contentType: z.string().refine((t) => t === "" || t === "application/pdf", {
      message: "Only PDF files can be uploaded.",
    }),
  }),
);

const registerInput = uploadTarget.and(
  z.object({
    path: z.string().regex(/^tenders\/[0-9a-f-]{36}\.pdf$/),
    originalName: z.string().min(1).max(255),
  }),
);

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid upload.";
}

function errorMessage(error: unknown): string {
  console.error("tender upload", error);
  return "The upload could not be saved. Please try again.";
}

/** Step 1: validate the file's metadata and issue a one-time signed upload URL to Storage. */
export async function prepareTenderUpload(input: unknown): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = prepareInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    if (parsed.data.role === "addendum" && !(await getOpportunityForAddendum(parsed.data.opportunityId!))) {
      return { ok: false, error: "That tender has no main document to attach an addendum to." };
    }
    // The stored name is random; the user's file name is kept in sources.original_name.
    const path = `tenders/${randomUUID()}.pdf`;
    const { data, error } = await getServiceClient().storage.from(SOURCES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("no signed upload URL");
    return { ok: true, data: { path, token: data.token } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export type RegisterResult =
  | { status: "created"; opportunityId: string; pages: number; needsOcr: number }
  | { status: "duplicate"; opportunityId: string | null; originalName: string };

/**
 * Step 2: after the browser uploaded the file, check the real bytes, then record the source and
 * its page text. An identical file uploaded before is reported, never silently merged.
 */
export async function registerTenderUpload(input: unknown): Promise<ActionResult<RegisterResult>> {
  const parsed = registerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { path, originalName, role, opportunityId } = parsed.data;
  const bucket = getServiceClient().storage.from(SOURCES_BUCKET);
  const discard = () => bucket.remove([path]).catch(() => undefined);

  try {
    const { data: blob, error } = await bucket.download(path);
    if (error || !blob) return { ok: false, error: "The upload did not arrive. Please try again." };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > MAX_PDF_BYTES || !isPdfBytes(bytes)) {
      await discard();
      return { ok: false, error: "This file is not a valid PDF (or is too large)." };
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const existing = await findSourceBySha256(sha256);
    if (existing) {
      await discard();
      return {
        ok: true,
        data: { status: "duplicate", opportunityId: existing.opportunity_id, originalName: existing.original_name },
      };
    }

    let pages;
    try {
      pages = await parsePdfPages(bytes);
    } catch {
      await discard();
      return { ok: false, error: "This PDF could not be read. It may be damaged or password-protected." };
    }
    if (pages.length === 0) {
      await discard();
      return { ok: false, error: "This PDF has no pages." };
    }

    const created = await createPdfSource({ role, opportunityId, storagePath: path, originalName, sha256, pages });
    return {
      ok: true,
      data: {
        status: "created",
        opportunityId: created.opportunityId,
        pages: pages.length,
        needsOcr: pages.filter((p) => p.needsOcr).length,
      },
    };
  } catch (error) {
    await discard();
    return { ok: false, error: errorMessage(error) };
  }
}
