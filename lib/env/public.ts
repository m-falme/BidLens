import { parseEnv, publicEnvSchema, type PublicEnv } from "./schema";

let cached: PublicEnv | undefined;

/** Safe in client code. Next.js only inlines `NEXT_PUBLIC_*` vars referenced literally, hence no spread of `process.env`. */
export function getPublicEnv(): PublicEnv {
  cached ??= parseEnv(
    publicEnvSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    "public",
  );
  return cached;
}
