/**
 * Deletes one tender that produced no readable facts, and lists any other tender
 * with no source-confirmed fact and no closing date. Run once:
 *
 *   npx tsx scripts/remove-unread-tender.mts
 *
 * Child rows (fields, requirements, reviews, decisions, action items, the file)
 * go with it. The list is printed and left in place.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseEnv, serverEnvSchema } from "@/lib/env/schema";

const NYAMIRA_ID = "4a6d7a39-7a24-45ba-b5dc-bf855f5eac67";

interface OpportunityRow {
  id: string;
  title: string;
  organization: string | null;
  deadline_at: string | null;
  type: string;
}

interface FieldRow {
  opportunity_id: string;
  status: string;
  key: string;
  value: string | null;
}

function hasClosingDate(deadlineAt: string | null, fields: readonly FieldRow[]): boolean {
  if (deadlineAt) return true;
  return fields.some((field) => field.key === "closing_datetime" && Boolean(field.value?.trim()));
}

function confirmedCount(fields: readonly FieldRow[]): number {
  return fields.filter((field) => field.status === "source_confirmed").length;
}

function deleteSql(): string {
  const id = NYAMIRA_ID;
  return `
do $body$
begin
  alter table public.stage_reviews disable trigger stage_reviews_no_delete;
  alter table public.bid_decisions disable trigger bid_decisions_no_delete;
  delete from public.fields where opportunity_id = '${id}';
  delete from public.requirements where opportunity_id = '${id}';
  delete from public.action_items where tender_id = '${id}';
  delete from public.stage_reviews where tender_id = '${id}';
  delete from public.bid_decisions where tender_id = '${id}';
  delete from public.risk_assessments where opportunity_id = '${id}';
  delete from public.decisions where opportunity_id = '${id}';
  delete from public.proposals where opportunity_id = '${id}';
  delete from public.activities where opportunity_id = '${id}';
  delete from public.duplicate_candidates where opportunity_id = '${id}' or candidate_id = '${id}';
  delete from public.extraction_runs where source_id in (select id from public.sources where opportunity_id = '${id}');
  delete from public.sources where opportunity_id = '${id}';
  delete from public.opportunities where id = '${id}';
  alter table public.stage_reviews enable trigger stage_reviews_no_delete;
  alter table public.bid_decisions enable trigger bid_decisions_no_delete;
end
$body$;
`;
}

function runDeleteSql(): void {
  const dir = mkdtempSync(join(tmpdir(), "bidlens-delete-"));
  const file = join(dir, "delete.sql");
  writeFileSync(file, deleteSql(), "utf8");
  try {
    execSync(`npx supabase db query --remote --yes -f "${file}"`, { stdio: "inherit" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const env = parseEnv(
    serverEnvSchema.pick({ NEXT_PUBLIC_SUPABASE_URL: true, SUPABASE_SERVICE_ROLE_KEY: true }),
    process.env,
    "server",
  );
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: opportunities, error: opportunityError }, { data: fields, error: fieldError }] = await Promise.all([
    db.from("opportunities").select("id, title, organization, deadline_at, type"),
    db.from("fields").select("opportunity_id, status, key, value"),
  ]);
  if (opportunityError) throw new Error(opportunityError.message);
  if (fieldError) throw new Error(fieldError.message);

  const byTender = new Map<string, FieldRow[]>();
  for (const field of (fields ?? []) as FieldRow[]) {
    const list = byTender.get(field.opportunity_id) ?? [];
    list.push(field);
    byTender.set(field.opportunity_id, list);
  }

  const empty = ((opportunities ?? []) as OpportunityRow[]).filter((tender) => {
    const rows = byTender.get(tender.id) ?? [];
    return confirmedCount(rows) === 0 && !hasClosingDate(tender.deadline_at, rows);
  });
  const others = empty.filter((tender) => tender.id !== NYAMIRA_ID);

  console.log("Other tenders with no source-confirmed fact and no closing date (left in place):");
  if (others.length === 0) console.log("  none");
  for (const tender of others) {
    const buyer = tender.organization?.trim() || "Buyer not stated";
    console.log(`  ${tender.id}  ${tender.type}  ${tender.title}  ${buyer}`);
  }

  const { data: target, error: targetError } = await db
    .from("opportunities")
    .select("id, title, organization")
    .eq("id", NYAMIRA_ID)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) {
    console.log(`Nyamira ${NYAMIRA_ID} is already gone.`);
    return;
  }

  const [{ count: fieldCount }, { count: requirementCount }, { count: reviewCount }, { count: decisionCount }, { count: actionCount }, { data: sources, error: sourceError }] =
    await Promise.all([
      db.from("fields").select("id", { count: "exact", head: true }).eq("opportunity_id", NYAMIRA_ID),
      db.from("requirements").select("id", { count: "exact", head: true }).eq("opportunity_id", NYAMIRA_ID),
      db.from("stage_reviews").select("id", { count: "exact", head: true }).eq("tender_id", NYAMIRA_ID),
      db.from("bid_decisions").select("id", { count: "exact", head: true }).eq("tender_id", NYAMIRA_ID),
      db.from("action_items").select("id", { count: "exact", head: true }).eq("tender_id", NYAMIRA_ID),
      db.from("sources").select("id, storage_path, original_name").eq("opportunity_id", NYAMIRA_ID),
    ]);
  if (sourceError) throw new Error(sourceError.message);
  const files = (sources ?? []).flatMap((source) => (source.storage_path ? [source.storage_path] : []));
  console.log(`Deleting ${target.title} (${NYAMIRA_ID}).`);
  console.log(
    `  fields ${fieldCount ?? 0}, requirements ${requirementCount ?? 0}, stage_reviews ${reviewCount ?? 0}, bid_decisions ${decisionCount ?? 0}, action_items ${actionCount ?? 0}, storage files ${files.length}.`,
  );
  for (const file of files) console.log(`  file ${file}`);

  runDeleteSql();

  if (files.length > 0) {
    const removed = await db.storage.from("sources").remove(files);
    if (removed.error) throw new Error(removed.error.message);
  }

  const { data: stillThere, error: afterError } = await db
    .from("opportunities")
    .select("id")
    .eq("id", NYAMIRA_ID)
    .maybeSingle();
  if (afterError) throw new Error(afterError.message);
  if (stillThere) throw new Error("Nyamira is still in the database.");
  console.log("Deleted Nyamira and its child rows.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
