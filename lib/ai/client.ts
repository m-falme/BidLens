import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { getServerEnv } from "@/lib/env/server";

export interface ConfiguredModel {
  provider: string;
  modelId: string;
  model: LanguageModel;
}

/** The model named by LLM_PROVIDER / LLM_MODEL, authenticated with LLM_API_KEY. Swapping providers is an env change. */
export function getConfiguredModel(): ConfiguredModel {
  const env = getServerEnv();
  const apiKey = env.LLM_API_KEY;
  const modelId = env.LLM_MODEL;
  switch (env.LLM_PROVIDER) {
    case "google":
      return { provider: "google", modelId, model: createGoogleGenerativeAI({ apiKey })(modelId) };
    case "openai":
      return { provider: "openai", modelId, model: createOpenAI({ apiKey })(modelId) };
    case "anthropic":
      return { provider: "anthropic", modelId, model: createAnthropic({ apiKey })(modelId) };
  }
}
