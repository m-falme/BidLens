/**
 * Loads the demo data into Supabase. Idempotent: ids are deterministic, reference data
 * (company, capabilities, CoB figures, county risk) is refreshed, and records people edit
 * (opportunities, sources, fields) are only inserted, never overwritten.
 *
 *   npm run db:seed -- --dry-run   build and validate every row, print counts, no network
 *   npm run db:seed                write to the project in NEXT_PUBLIC_SUPABASE_URL
 *
 * A CLI script, not app code: it can't import "server-only", and the service-role key is
 * read only here, from the local environment.
 */
import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { parseEnv, serverEnvSchema } from "@/lib/env/schema";

import { buildSeedPlan } from "./build";
import { runSeed, supabaseWriter } from "./writer";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const plan = await buildSeedPlan(process.cwd());

  for (const step of plan.steps) {
    console.log(`${step.table.padEnd(22)} ${String(step.rows.length).padStart(4)} rows (${step.mode})`);
  }
  const bands = Object.groupBy(plan.countyRisk, (r) => r.band);
  console.log(
    "county_risk bands:",
    Object.entries(bands)
      .map(([band, rows]) => `${band} ${rows?.length ?? 0}`)
      .join(", "),
  );

  if (dryRun) {
    console.log("Dry run: nothing written.");
    return;
  }

  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const env = parseEnv(
    serverEnvSchema.pick({ NEXT_PUBLIC_SUPABASE_URL: true, SUPABASE_SERVICE_ROLE_KEY: true }),
    process.env,
    "server",
  );
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await runSeed(plan.steps, supabaseWriter(client));
  console.log(`Seeded ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
