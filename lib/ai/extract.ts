import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import type { z } from "zod";

/**
 * Structured extraction with the ARCHITECTURE §6 contract: temperature 0, 45 s timeout, one
 * retry that shows the model its zod error, and a log line per attempt. Takes the model as an
 * argument so tests can pass a mock; app code gets it from lib/ai/client.ts.
 *
 * Uses `generateText` + `Output.object`, the AI SDK 7 replacement for the deprecated
 * `generateObject`: same zod-validated structured output.
 */

export const LLM_TIMEOUT_MS = 45_000;

export interface ExtractRequest<TSchema extends z.ZodType> {
  model: LanguageModel;
  schema: TSchema;
  instructions: string;
  prompt: string;
  promptVersion: string;
  /** Names the call in logs, e.g. "payment@nairobi_tender.pdf". */
  label: string;
}

export interface ExtractUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  attempts: number;
}

export type ExtractResult<T> =
  | { ok: true; output: T; usage: ExtractUsage }
  | { ok: false; error: string; usage: ExtractUsage };

function modelId(model: LanguageModel): string {
  return typeof model === "string" ? model : `${model.provider}:${model.modelId}`;
}

/** Short, log-safe description of why an attempt failed (no page text, no keys). */
function describeError(error: unknown): string {
  if (NoObjectGeneratedError.isInstance(error)) {
    const cause = error.cause instanceof Error ? error.cause.message : String(error.cause ?? "");
    return `output did not match the schema: ${cause}`.slice(0, 1500);
  }
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

export async function extractStructured<TSchema extends z.ZodType>(
  request: ExtractRequest<TSchema>,
): Promise<ExtractResult<z.infer<TSchema>>> {
  const usage: ExtractUsage = { inputTokens: 0, outputTokens: 0, latencyMs: 0, attempts: 0 };
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt =
      attempt === 1
        ? request.prompt
        : `${request.prompt}\n\nYour previous answer was rejected: ${lastError}\nReturn output that matches the schema exactly.`;
    const started = Date.now();
    usage.attempts = attempt;
    try {
      const result = await generateText({
        model: request.model,
        instructions: request.instructions,
        prompt,
        output: Output.object({ schema: request.schema }),
        temperature: 0,
        timeout: LLM_TIMEOUT_MS,
      });
      const latencyMs = Date.now() - started;
      usage.latencyMs += latencyMs;
      usage.inputTokens += result.usage.inputTokens ?? 0;
      usage.outputTokens += result.usage.outputTokens ?? 0;
      logCall(request, attempt, latencyMs, result.usage.inputTokens, result.usage.outputTokens, "ok");
      return { ok: true, output: result.output as z.infer<TSchema>, usage };
    } catch (error) {
      const latencyMs = Date.now() - started;
      usage.latencyMs += latencyMs;
      if (NoObjectGeneratedError.isInstance(error)) {
        usage.inputTokens += error.usage?.inputTokens ?? 0;
        usage.outputTokens += error.usage?.outputTokens ?? 0;
      }
      lastError = describeError(error);
      logCall(request, attempt, latencyMs, undefined, undefined, lastError);
      // Only a schema failure is worth a corrective retry; network errors were already retried by the SDK.
      if (!NoObjectGeneratedError.isInstance(error)) break;
    }
  }
  return { ok: false, error: lastError, usage };
}

function logCall(
  request: ExtractRequest<z.ZodType>,
  attempt: number,
  latencyMs: number,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  outcome: string,
): void {
  if (process.env.VITEST) return;
  console.info(
    JSON.stringify({
      event: "llm_extract",
      label: request.label,
      prompt_version: request.promptVersion,
      model: modelId(request.model),
      attempt,
      latency_ms: latencyMs,
      input_tokens: inputTokens ?? null,
      output_tokens: outputTokens ?? null,
      outcome,
    }),
  );
}
