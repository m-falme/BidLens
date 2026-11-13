"use server";

import { revalidatePath } from "next/cache";

import { upsertActionItem } from "@/lib/db/queries/action-items";
import { insertBidDecision } from "@/lib/db/queries/bid-decisions";
import { insertStageReview } from "@/lib/db/queries/stage-reviews";
import { saveTenderFigures } from "@/lib/db/queries/tenders";
import { parseActionItem } from "@/lib/plan/save";
import { parseBidDecision } from "@/lib/recommendation/decision";
import { parseTenderFigures } from "@/lib/recommendation/profit";
import { parseStageReview } from "@/lib/tenders/stage-review";

export type StageReviewActionResult = { ok: true } | { ok: false; error: string };

function actionError(error: unknown, fallback: string): string {
  console.error(fallback, error);
  if (error instanceof Error && error.message === "That tender was not found.") return error.message;
  return fallback;
}

export async function saveStageReview(input: unknown): Promise<StageReviewActionResult> {
  const parsed = parseStageReview(input);
  if (!parsed.ok) return parsed;
  try {
    await insertStageReview(parsed.value);
    revalidatePath(`/tenders/${parsed.value.tenderId}`);
    revalidatePath("/tenders");
    revalidatePath("/");
    revalidatePath("/trail");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "The review could not be saved. Please try again.") };
  }
}

export async function saveTenderFiguresAction(input: unknown): Promise<StageReviewActionResult> {
  const parsed = parseTenderFigures(input);
  if (!parsed.ok) return parsed;
  try {
    await saveTenderFigures(parsed.value);
    revalidatePath(`/tenders/${parsed.value.tenderId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "The figures could not be saved. Please try again.") };
  }
}

export async function saveBidDecisionAction(input: unknown): Promise<StageReviewActionResult> {
  const parsed = parseBidDecision(input);
  if (!parsed.ok) return parsed;
  try {
    await insertBidDecision(parsed.value);
    revalidatePath(`/tenders/${parsed.value.tenderId}`);
    revalidatePath("/tenders");
    revalidatePath("/");
    revalidatePath("/trail");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "The decision could not be saved. Please try again.") };
  }
}

export async function saveActionItem(input: unknown): Promise<StageReviewActionResult> {
  const parsed = parseActionItem(input);
  if (!parsed.ok) return parsed;
  try {
    await upsertActionItem(parsed.value);
    revalidatePath(`/tenders/${parsed.value.tenderId}`);
    revalidatePath(`/tenders/${parsed.value.tenderId}/plan`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "The plan item could not be saved. Please try again.") };
  }
}
