"use server";

import { revalidatePath } from "next/cache";

import { saveWorkspaceSettings } from "@/lib/db/queries/settings";
import { parseSettings } from "@/lib/settings/schema";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

export async function saveSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = parseSettings(input);
  if (!parsed.ok) return parsed;
  try {
    await saveWorkspaceSettings(parsed.value);
  } catch (error) {
    console.error("save settings", error);
    return { ok: false, error: "The settings could not be saved. Please try again." };
  }
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/tenders", "layout");
  return { ok: true };
}
