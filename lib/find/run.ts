import { createHash } from "node:crypto";

import type { LanguageModel } from "ai";

import { extractStructured } from "@/lib/ai/extract";
import { buildFindFitPrompt, FIND_FIT_INSTRUCTIONS, FIND_FIT_PROMPT_VERSION } from "@/lib/ai/prompts/find-fit.v1";
import { findFitOutputSchema } from "@/lib/ai/schemas";

import type { FindProfile } from "./checks";
import { applyAiFit, rankByCode, topForAi, type RankedTender } from "./rank";
import type { TenderSource } from "./source";

export type AiStatus = "used" | "failed" | "not_configured";

export interface FindResult {
  ranked: RankedTender[];
  /** e.g. "sample dataset (60 tenders)". */
  sourceLabel: string;
  aiStatus: AiStatus;
  /** When the ranking was made (ISO). A cached result keeps its original time. */
  rankedAt: string;
  cached: boolean;
}

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; result: FindResult }>();

export function clearFindCache(): void {
  cache.clear();
}

function cacheKey(profile: FindProfile, ids: readonly string[], now: Date): string {
  // The day is in the key: a tender that closes tomorrow must not stay "open" in a cached answer.
  return createHash("sha256")
    .update(JSON.stringify([profile, ids, now.toISOString().slice(0, 10)]))
    .digest("hex");
}

/**
 * Reads tenders from `source`, applies the hard checks in code, then asks the model (if any) for plain reasons and a
 * fit score on the top 15 in one call. If the call fails the code-only ranking is returned. The result is kept for
 * 30 minutes so pressing the button again does not call the model again.
 */
export async function findTenders(input: {
  source: TenderSource;
  profile: FindProfile;
  /** Null when no model is configured: code-only ranking. */
  model: LanguageModel | null;
  now?: Date;
  refresh?: boolean;
}): Promise<FindResult> {
  const now = input.now ?? new Date();
  const tenders = await input.source.fetchTenders();
  const key = cacheKey(input.profile, tenders.map((t) => t.id), now);
  const hit = cache.get(key);
  if (!input.refresh && hit && now.getTime() - hit.at < CACHE_MS) return { ...hit.result, cached: true };

  let ranked = rankByCode(tenders, input.profile, now);
  let aiStatus: AiStatus = "not_configured";
  if (input.model) {
    const top = topForAi(ranked);
    const answer = await extractStructured({
      model: input.model,
      schema: findFitOutputSchema,
      instructions: FIND_FIT_INSTRUCTIONS,
      prompt: buildFindFitPrompt(input.profile, top),
      promptVersion: FIND_FIT_PROMPT_VERSION,
      label: "find-fit",
    });
    if (answer.ok) {
      ranked = applyAiFit(ranked, answer.output.results);
      aiStatus = "used";
    } else {
      aiStatus = "failed";
    }
  }

  const result: FindResult = {
    ranked,
    sourceLabel: input.source.describe(tenders),
    aiStatus,
    rankedAt: now.toISOString(),
    cached: false,
  };
  // A failed AI call is not cached, so the next press can try again.
  if (aiStatus !== "failed") cache.set(key, { at: now.getTime(), result });
  return result;
}
