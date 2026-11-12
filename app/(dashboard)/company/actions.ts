"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { insertOtherDocument, updateCompanyDocument } from "@/lib/db/queries/company";
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
    revalidatePath("/company");
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
    revalidatePath("/company");
    revalidatePath("/tenders", "layout");
    return { ok: true };
  } catch (error) {
    console.error("add company document", error);
    return { ok: false, error: "The document could not be added. Please try again." };
  }
}
