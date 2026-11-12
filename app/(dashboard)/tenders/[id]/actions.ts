"use server";

import { revalidatePath } from "next/cache";

import { insertStageReview } from "@/lib/db/queries/stage-reviews";
import { parseStageReview } from "@/lib/tenders/stage-review";

export type StageReviewActionResult = { ok: true } | { ok: false; error: string };

export async function saveStageReview(input: unknown): Promise<StageReviewActionResult> {
  const parsed = parseStageReview(input);
  if (!parsed.ok) return parsed;
  try {
    await insertStageReview(parsed.value);
    revalidatePath(`/tenders/${parsed.value.tenderId}`);
    return { ok: true };
  } catch (error) {
    console.error("save stage review", error);
    return { ok: false, error: "The review could not be saved. Please try again." };
  }
}
