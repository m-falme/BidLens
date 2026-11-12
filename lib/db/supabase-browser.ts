"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";

let client: SupabaseClient | undefined;

/**
 * Publishable-key client. RLS gives it no table access; it is used only to upload a file to a
 * signed Storage URL that the server issued.
 */
export function getBrowserClient(): SupabaseClient {
  if (!client) {
    const env = getPublicEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
