import { z } from "zod";

export const LLM_PROVIDERS = ["google", "openai", "anthropic"] as const;

/** `KEY=` lines copied from .env.example arrive as "", which must count as missing. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const required = () => z.preprocess(blankToUndefined, z.string());
const optional = () => z.preprocess(blankToUndefined, z.string().optional());

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    blankToUndefined,
    z
      .url({ message: "must be a URL, e.g. https://xyz.supabase.co" })
      // supabase-js appends /rest/v1 itself; a pasted API endpoint would double it.
      .refine((value) => !URL.canParse(value) || new URL(value).pathname === "/", {
        message: "must be the project URL with no path, e.g. https://xyz.supabase.co (not …/rest/v1)",
      }),
  ),
  // Publishable (sb_publishable_…) or legacy anon key; opaque, the shape is not checked.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(),
});

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: required(),
  LLM_PROVIDER: z.preprocess(
    blankToUndefined,
    z
      .enum(LLM_PROVIDERS, { message: `must be one of: ${LLM_PROVIDERS.join(", ")}` })
      .default("google"),
  ),
  LLM_MODEL: required(),
  LLM_API_KEY: required(),
  // Voice is P2: the app must run without Sauti; lib/voice enforces these when used.
  SAUTI_API_URL: z.preprocess(blankToUndefined, z.url({ message: "must be a URL" }).optional()),
  SAUTI_API_KEY: optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type EnvScope = "public" | "server";

export class EnvValidationError extends Error {
  readonly problems: readonly string[];

  constructor(scope: EnvScope, problems: readonly string[]) {
    super(
      [
        `Invalid ${scope} environment variables:`,
        ...problems.map((problem) => `  - ${problem}`),
        "Copy .env.example to .env.local and fill in the values (or set them in the Vercel project settings).",
      ].join("\n"),
    );
    this.name = "EnvValidationError";
    this.problems = problems;
  }
}

type EnvSource = Record<string, string | undefined>;

/**
 * Validates `source` against `schema` and reports every problem at once.
 * Messages name the variable but never echo its value, so secrets can't leak into logs.
 */
export function parseEnv<TSchema extends z.ZodObject>(
  schema: TSchema,
  source: EnvSource,
  scope: EnvScope,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "(root)");
    const isMissing = blankToUndefined(source[key]) === undefined;
    return isMissing ? `${key}: missing` : `${key}: ${issue.message}`;
  });
  throw new EnvValidationError(scope, problems);
}
