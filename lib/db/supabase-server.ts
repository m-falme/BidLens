import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getDatabaseEnv } from "@/lib/env/server";

import type { Database } from "./database.types";

export type ServiceClient = SupabaseClient<Database>;

let client: ServiceClient | undefined;

/** Service-role client: bypasses RLS, so it must never reach the browser (ARCHITECTURE §4). */
export function getServiceClient(): ServiceClient {
  if (!client) {
    const env = getDatabaseEnv();
    client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const SOURCES_BUCKET = "sources";
