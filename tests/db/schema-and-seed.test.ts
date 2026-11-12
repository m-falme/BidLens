import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildSeedPlan, type SeedPlan } from "@/supabase/seed/build";
import { seedId } from "@/supabase/seed/ids";
import { runSeed, type SeedWriter } from "@/supabase/seed/writer";

/** Same contract as the Supabase writer (upsert on id; insert_only = do nothing on conflict), in plain SQL. */
function pgliteWriter(db: PGlite): SeedWriter {
  return {
    async upsert(table, rows, mode) {
      if (rows.length === 0) return;
      const columns = Object.keys(rows[0]);
      const params: unknown[] = [];
      const tuples = rows.map((row) => {
        const record = row as Record<string, unknown>;
        const slots = columns.map((col) => {
          const value = record[col];
          params.push(value !== null && typeof value === "object" ? JSON.stringify(value) : value);
          return `$${params.length}`;
        });
        return `(${slots.join(", ")})`;
      });
      const updates = columns.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`);
      const conflict = mode === "insert_only" ? "do nothing" : `do update set ${updates.join(", ")}`;
      await db.query(
        `insert into public.${table} (${columns.join(", ")}) values ${tuples.join(", ")} on conflict (id) ${conflict}`,
        params,
      );
    },
  };
}

const TABLES = [
  "activities", "capabilities", "companies", "county_pending_bills", "county_risk", "decisions",
  "duplicate_candidates", "fields", "opportunities", "proposals", "requirements", "risk_assessments",
  "source_pages", "sources",
];

let db: PGlite;
let plan: SeedPlan;

async function count(table: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return rows[0].n;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<T>(sql, params);
  return rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/0004_company_documents.sql", "utf8"));
  plan = await buildSeedPlan(process.cwd());
  await runSeed(plan.steps, pgliteWriter(db));
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("0001_init.sql", () => {
  it("creates every §4 table with RLS enabled", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual(TABLES);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it("indexes every foreign key", async () => {
    const { rows } = await db.query<{ fk: string }>(`
      select c.conrelid::regclass || '.' || a.attname as fk
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
        )`);
    expect(rows.map((r) => r.fk)).toEqual([]);
  });
});

describe("seed", () => {
  it("loads the company, capabilities, 15 leads with evidence and 47 counties", async () => {
    expect(await count("companies")).toBe(1);
    expect(await count("capabilities")).toBe(74 + 12);
    expect(
      await one<{ have: number; missing: number; declared: number }>(
        `select count(*) filter (where holding = 'have')::int as have,
                count(*) filter (where holding = 'dont_have')::int as missing,
                count(*) filter (where self_declared)::int as declared
         from public.capabilities`,
      ),
    ).toEqual({ have: 5, missing: 7, declared: 5 });
    expect(
      await one<{ field: number; procurement: number }>(
        `select count(*) filter (where type = 'field')::int as field,
                count(*) filter (where type = 'procurement')::int as procurement from public.opportunities`,
      ),
    ).toEqual({ field: 10, procurement: 5 });
    expect(await count("sources")).toBe(15);
    expect(await count("fields")).toBe(10 * 19 + 5 * 21);
    expect(await count("county_pending_bills")).toBe(94);
    expect(await count("county_risk")).toBe(47);
  });

  it("confirms every seeded field by quote check and links it to a page", async () => {
    expect(
      await one<{ n: number }>(
        `select count(*)::int as n from public.fields f
         join public.source_pages p on p.source_id = f.source_id and p.page_no = f.page_no
         where f.status = 'source_confirmed' and position(lower(f.quote) in lower(p.text)) > 0`,
      ),
    ).toEqual({ n: 295 });
  });

  it("stores county risk matching §5.3 and links it to the CoB row", async () => {
    const nairobi = await one<{ score: string; band: string; report_date: string }>(
      `select r.score::text, r.band, b.report_date::text from public.county_risk r
       join public.county_pending_bills b on b.id = r.pending_bills_id where r.county = 'Nairobi'`,
    );
    expect(nairobi).toEqual({ score: "76.5", band: "severe", report_date: "2026-06-30" });
    expect(await one(`select score, band from public.county_risk where county = 'Nandi'`)).toEqual({
      score: null,
      band: "unknown",
    });
  });

  it("is idempotent: a second run changes no counts", async () => {
    const before = await Promise.all(TABLES.map(count));
    await runSeed(plan.steps, pgliteWriter(db));
    expect(await Promise.all(TABLES.map(count))).toEqual(before);
  });

  it("never overwrites a human edit, and the edit keeps the original value", async () => {
    const id = seedId("field", seedId("opportunity", "field", "Bluehaven SACCO"), "phone");
    await db.query(`update public.fields set value = '+254700000105', edited_by = 'test' where id = $1`, [id]);
    await runSeed(plan.steps, pgliteWriter(db));
    expect(
      await one(`select value, original_value, edited_at is not null as edited from public.fields where id = $1`, [id]),
    ).toEqual({ value: "+254700000105", original_value: "0700 000 105", edited: true });
  });

  it("keeps a company-document status a person changed, and the first status", async () => {
    const id = seedId("capability", seedId("company", "Zanari Analytics"), "document", "CR12");
    await db.query(`update public.capabilities set holding = 'expired', expires_on = '2024-01-01' where id = $1`, [id]);
    await runSeed(plan.steps, pgliteWriter(db));
    expect(
      await one(`select holding, original_holding, expires_on::text as expires_on from public.capabilities where id = $1`, [
        id,
      ]),
    ).toEqual({ holding: "expired", original_holding: "have", expires_on: "2024-01-01" });
    await expect(db.query(`update public.capabilities set original_holding = 'dont_have' where id = $1`, [id])).rejects.toThrow(
      /immutable/,
    );
  });

  it("refreshes reference data on re-run", async () => {
    await db.query(`update public.capabilities set detail = 'tampered' where name = 'Tableau'`);
    await runSeed(plan.steps, pgliteWriter(db));
    expect(await one(`select detail from public.capabilities where name = 'Tableau'`)).toEqual({
      detail: "Technology capabilities: Business Intelligence",
    });
  });
});

describe("database guards for the product rules", () => {
  const opportunityId = () => seedId("opportunity", "procurement", "SIM-TND-2026-001");

  it("rejects `met` without a capability record", async () => {
    await expect(
      db.query(
        `insert into public.requirements (opportunity_id, text, category, match) values ($1, 'Tax compliance', 'mandatory', 'met')`,
        [opportunityId()],
      ),
    ).rejects.toThrow(/requirements_met_needs_capability/);
  });

  it("rejects `source_confirmed` without a quote", async () => {
    await expect(
      db.query(
        `insert into public.fields (opportunity_id, key, value, confidence, status) values ($1, 'x', 'y', 0.9, 'source_confirmed')`,
        [opportunityId()],
      ),
    ).rejects.toThrow(/fields_confirmed_has_evidence/);
  });

  it("forbids overwriting the original value once a field has been edited", async () => {
    const id = seedId("field", seedId("opportunity", "field", "Bluehaven SACCO"), "phone");
    await expect(db.query(`update public.fields set original_value = 'rewritten' where id = $1`, [id])).rejects.toThrow(
      /immutable/,
    );
  });

  it("forbids overwriting a stored source", async () => {
    await expect(db.query(`update public.sources set raw_text = 'replaced'`)).rejects.toThrow(/immutable/);
  });

  it("keeps decisions append-only", async () => {
    await db.query(
      `insert into public.decisions (opportunity_id, choice, decided_by, snapshot_json) values ($1, 'skip', 'Bid Analyst', '{}')`,
      [opportunityId()],
    );
    await expect(db.query(`update public.decisions set choice = 'bid'`)).rejects.toThrow(/append-only/);
  });

  it("rejects an expiry date on a paper the team does not hold", async () => {
    await expect(
      db.query(`update public.capabilities set expires_on = '2026-01-01' where name = 'Tableau'`),
    ).rejects.toThrow(/capabilities_expiry_when_held/);
  });

  it("accepts a form marked to prepare", async () => {
    const { rows } = await db.query<{ match: string }>(
      `insert into public.requirements (opportunity_id, text, category, match)
       values ($1, 'Form of tender', 'mandatory', 'to_prepare') returning match`,
      [opportunityId()],
    );
    expect(rows[0].match).toBe("to_prepare");
  });

  it("rejects a score for an unknown band and unknown statuses", async () => {
    await expect(db.query(`update public.county_risk set score = 0 where county = 'Nandi'`)).rejects.toThrow(
      /county_risk_unknown_has_no_score/,
    );
    await expect(db.query(`update public.opportunities set status = 'maybe'`)).rejects.toThrow(/check constraint/);
  });

  it("sets updated_at on edit", async () => {
    const before = await one<{ t: string }>(`select updated_at::text as t from public.opportunities where id = $1`, [
      opportunityId(),
    ]);
    await db.query(`update public.opportunities set owner = 'Technical Lead' where id = $1`, [opportunityId()]);
    const after = await one<{ t: string }>(`select updated_at::text as t from public.opportunities where id = $1`, [
      opportunityId(),
    ]);
    expect(new Date(after.t).getTime()).toBeGreaterThan(new Date(before.t).getTime());
  });
});
