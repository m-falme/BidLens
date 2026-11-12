import "server-only";

import { databaseEnvSchema, parseEnv, serverEnvSchema, type DatabaseEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;
let cachedDatabase: DatabaseEnv | undefined;

/**
 * Validated server configuration. Throws `EnvValidationError` listing every missing
 * or invalid variable on first use, so a misconfigured deploy fails loudly at the
 * first server call that needs a secret instead of deep inside a provider SDK.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env, "server");
  return cached;
}

/** Only the Supabase variables, so data pages keep working while the LLM is unconfigured. */
export function getDatabaseEnv(): DatabaseEnv {
  cachedDatabase ??= parseEnv(databaseEnvSchema, process.env, "server");
  return cachedDatabase;
}
