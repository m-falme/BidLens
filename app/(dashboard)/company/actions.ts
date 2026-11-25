"use server";

import { revalidatePath } from "next/cache";

import { parseCapability, parseLegalName, parseRemoval } from "@/lib/company/profile";
import { addCompanyCapability, removeCompanyCapability, updateLegalName } from "@/lib/db/queries/company";

export type ProfileActionResult = { ok: true } | { ok: false; error: string };

/** Messages written for a person. Anything else is logged and shown as the fallback. */
const KNOWN = new Set([
  "That is already on your profile.",
  "That item was not found.",
  "This is stated in your company profile document, so it cannot be removed here.",
]);

function failure(error: unknown, fallback: string): ProfileActionResult {
  console.error(fallback, error);
  return { ok: false, error: error instanceof Error && KNOWN.has(error.message) ? error.message : fallback };
}

function refresh() {
  revalidatePath("/company");
  revalidatePath("/");
  // Tender compliance is matched against these, so tender pages must read them again.
  revalidatePath("/tenders", "layout");
}

export async function saveLegalNameAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = parseLegalName(input);
  if (!parsed.ok) return parsed;
  try {
    await updateLegalName(parsed.value);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "The registered name could not be saved. Please try again.");
  }
}

export async function addCapabilityAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = parseCapability(input);
  if (!parsed.ok) return parsed;
  try {
    await addCompanyCapability(parsed.value.kind, parsed.value.name);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "It could not be added. Please try again.");
  }
}

export async function removeCapabilityAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = parseRemoval(input);
  if (!parsed.ok) return { ok: false, error: "That item was not found." };
  try {
    await removeCompanyCapability(parsed.id);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "It could not be removed. Please try again.");
  }
}
