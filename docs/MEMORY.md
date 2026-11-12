# MEMORY — BidLens
> Cursor: update this at the end of every step. Keep it under ~60 lines. Newest first in "Log".

## Status
- **Current step:** 2b done: live Supabase `BidLens` (ref `kezzkmcfsjabqhlciywr`, eu-west-3) linked, migrated, seeded, counts verified
- **Deployed URL:** —
- **Repo:** https://github.com/m-falme/BidLens, branch `main`
- **Gate:** Thu 12 Nov 2026 · assessment 14:00–15:30 EAT · cut 16:00

## P0 checklist (gate)
- [ ] 1. Tender upload + extraction with evidence
- [ ] 2. Quote check + human correction
- [ ] 3. Readiness (met / missing / unclear)
- [ ] 4. Payment risk card + margin table + recommendation
- [ ] 5. Deployed public link with seeded demo data

## Decisions
- 2026-11-12: Single Next.js app (no separate Python backend) for speed and one deploy.
- 2026-11-12: Status of a field is set by code (quote check), never by the LLM.
- 2026-11-12: Risk = scenarios, never a prediction of payment date.
- 2026-11-12: Next.js 16.4 (App Router, Turbopack, Cache Components on), Tailwind v4, shadcn base-nova (Base UI, not Radix: use `render={<Link/>}`, not `asChild`), zod 4, Vitest 5, Node ≥ 22.
- 2026-11-12: `agentRules: false` in next.config so `next dev` never rewrites our AGENTS.md.
- 2026-11-12: Env: `lib/env/schema.ts` (pure, tested), `lib/env/server.ts` (`server-only`, `getServerEnv()`), `lib/env/public.ts`. Validated on first use (not at boot) so the app runs before keys exist; lists every missing var, never prints values. Sauti vars optional (P2).
- 2026-11-12: Nav + page copy defined once in `components/app-shell/nav.ts`. `text-sm` raised to 15px for projector.
- 2026-11-12: `app/api/*` routes not stubbed yet (they'd be feature code); added with their step.
- 2026-11-12: Status vocabularies = text + CHECK (snake_case: `severe`, `verification_required`, …); UI maps to labels. DB enforces: `met` needs capability_id, `source_confirmed` needs source+page+quote, first edit copies value → `original_value` (then immutable), sources immutable, decisions/activities append-only, unknown band ⇔ null score. FKs `on delete restrict` (no silent data loss).
- 2026-11-12: Seed ids are deterministic UUID v5 (`supabase/seed/ids.ts`). Reference data (company, capabilities, CoB, county_risk) upserts; lead records (opportunities, sources, pages, fields) are insert-only, so re-seeding never overwrites human edits.
- 2026-11-12: Each workbook row = one `form` source with one page (row as "Header: value" lines); each cell = a field quoted from it, status set by `lib/verify/quote-check.ts`. Confidence = workbook "AI Confidence" for field leads, 1 for procurement rows (copied verbatim).
- 2026-11-12: Workbook statuses not in the glossary: "New - verify notice" → `new`, "No decision yet" → `potential`; verbatim kept in field `lead_status`.
- 2026-11-12: County score = round1(A+B+C) on exact parts, rounded once (gives §5.3 values). Parts A/B stored and shown as whole numbers with `PARTS_ROUNDED_NOTE` (Nairobi 36/30/10, score 76.5). Demo CSV sums pre-rounded parts → 14 scores differ by 0.1, all bands equal (pinned in test). Migori's CSV `payables_to_budget_pct` 8.82 ≠ total/budget 8.60; we compute from total/budget.
- 2026-11-12: Supabase uses the new opaque keys (`sb_publishable_…` in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `sb_secret_…` in `SUPABASE_SERVICE_ROLE_KEY`). Never parse them as JWTs. Env schema rejects a Supabase URL with a path (e.g. `/rest/v1`).
- 2026-11-12: Supabase CLI 3.x targets the local stack by default: always pass `--remote` (`npx supabase db push --remote`, `db query --remote --read-only`). Link and push used a temporary login role, so no DB password was needed or stored.
- 2026-11-12: CoB retrieved 2026-11-11 (`COB_RETRIEVED_AT`, both the Jun 2025 and Jun 2026 snapshots); figures as at each row's report_date.
- 2026-11-12: margin.ts nets `ir` in break-even and price-to-keep-margin (ARCHITECTURE §5.3 updated; same result when ir = 0).
- 2026-11-12: Profile has no certifications/documents/clients → none seeded (74 capabilities: 44 service, 22 tool, 8 sector). `verified=true` means "stated in a company document at evidence_ref".
- 2026-11-12: Migration + seed tested in PGlite (in-memory Postgres) inside Vitest, seeded twice for idempotency.

## Next
- Step 3: awaiting prompt. Likely `lib/db/` clients + generated types (`npx supabase gen types --remote`) replacing `supabase/seed/rows.ts`.

## Known issues / open questions
- Which LLM provider and key? (Gemini / OpenAI / other)
- MsingiAI Sauti endpoint, auth format and limits: get from the challenge owner.
- Ask mentors: must both intake options (field + procurement) be shown, or is one deep enough?
- Vercel project not linked; Vercel env vars must use the project URL with no path.
- `npm audit`: 12 low/moderate advisories in dev tooling; not triaged.
- With Cache Components, visited routes stay mounted but hidden (React Activity); tests must query `:visible`.
- 2025 CoB CSV labels Kakamega/Narok `MISSING` (no ageing); stored as `flagged` with the note.
- npm held back esbuild's postinstall (allowScripts); tsx works regardless.

## Log
- 2026-11-12 06:25 — Step 2b: linked + `db push --remote` (0001_init) + seeded live. Verified by SQL: 1 company, 74 capabilities, 15 leads, 295 fields (295 quote-confirmed), 94 CoB rows, 47 county risk; re-seed idempotent; publishable key reads 0 rows (RLS). Fixed `.env.local` URL (had `/rest/v1/`). 52 tests; build/lint/typecheck clean.
- 2026-11-12 05:00 — Step 2: `0001_init.sql` (14 tables, RLS, guards), `lib/risk/{county-score,margin,round}.ts`, `lib/verify/quote-check.ts`, `supabase/seed/*` + `npm run db:seed [-- --dry-run]`. 49 tests (incl. PGlite schema+seed). build/lint/typecheck clean.
- 2026-11-12 04:15 — Step 1: Next.js skeleton, shadcn sidebar shell (5 placeholder pages), §3 folders, .env.example, zod env loader + 5 Vitest tests. build/lint/typecheck/test clean.
- 2026-11-12 03:30 — Docs created: AGENTS.md, PRD.md, ARCHITECTURE.md, MEMORY.md.
