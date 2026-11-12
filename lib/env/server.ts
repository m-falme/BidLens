import "server-only";

import { parseEnv, serverEnvSchema, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

/**
 * Validated server configuration. Throws `EnvValidationError` listing every missing
 * or invalid variable on first use, so a misconfigured deploy fails loudly at the
 * first server call that needs a secret instead of deep inside a provider SDK.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env, "server");
  return cached;
}
