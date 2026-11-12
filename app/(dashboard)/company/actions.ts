"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateCompanyDocument } from "@/lib/db/queries/company";
import { DOCUMENT_HOLDINGS } from "@/lib/db/vocab";

const inputSchema = z.object({
  id: z.uuid(),
  holding: z.enum(DOCUMENT_HOLDINGS),
  expiresOn: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: "Enter a real expiry date." }),
});

export type DocumentActionResult = { ok: true } | { ok: false; error: string };

export async function saveCompanyDocument(input: unknown): Promise<DocumentActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the status and the date." };
  try {
    await updateCompanyDocument(parsed.data.id, parsed.data.holding, parsed.data.expiresOn || null);
    revalidatePath("/company");
    revalidatePath("/tenders", "layout");
    return { ok: true };
  } catch (error) {
    console.error("save company document", error);
    return { ok: false, error: "The status could not be saved. Please try again." };
  }
}
