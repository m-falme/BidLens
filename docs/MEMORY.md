# MEMORY — BidLens
> Cursor: update this at the end of every step. Keep it under ~60 lines. Newest first in "Log".

## Status
- **Current step:** 4 in progress. What-matters card is on the tender page. Readiness, payment risk, recommendation and deploy still to do.
- **Deployed URL:** —
- **Repo:** https://github.com/m-falme/BidLens, branch `main`
- **Gate:** Thu 12 Nov 2026 · assessment 14:00–15:30 EAT · cut 16:00

## P0 checklist (gate)
- [x] 1. Tender upload + extraction with evidence
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
- 2026-11-12 (step 3): AI SDK 7 marks `generateObject` deprecated → `lib/ai/extract.ts` uses `generateText` + `Output.object({schema})` (same zod-validated output). Temp 0, 45 s timeout, 1 corrective retry with the zod error, JSON log line per attempt. Model injected (mock in tests); `lib/ai/client.ts` (server-only) picks provider from env.
- 2026-11-12 (step 3): Prompts are versioned `.ts` files (`lib/ai/prompts/extract-tender.v1.ts`), not `.md`, so no fs reads/file tracing on Vercel. Run stores `prompt_version`.
- 2026-11-12 (step 3): Status decided only in `lib/verify/field-status.ts`: quote on cited page + value inside quote → confirmed; quote on page but value paraphrased → ai_inferred; value null + quote on page with a template blank (`____`, `.....`, `[insert…]`) → blank_in_source; else needs_human (reason stored per field is recomputed in UI). Group failing twice → needs_human rows (`extraction_failed`).
- 2026-11-12 (step 3): 8 field groups (`lib/tenders/field-catalog.ts`); BM25 (`lib/retrieval/bm25.ts`, hand-rolled, no dep) top-k + pinned pages, list groups also take the next page; docs ≤ 40k chars go whole. `bid_security` lives in the submission group (invitation-to-tender page). Inspect with `npx tsx scripts/inspect-tender.mts <pdf>`.
- 2026-11-12 (step 3): Upload = server action issues signed Storage URL → browser uploads direct (avoids Vercel 4.5 MB body limit) → second action re-checks `%PDF-` bytes + size (25 MB), sha256 duplicate check (reported, never merged; dup object deleted), unpdf pages (< 40 chars = `is_scanned`, i.e. needs OCR), inserts opportunity/source/pages.
- 2026-11-12 (step 3): Addendum = source `role='addendum'` on the same opportunity; it extracts the scalar groups + `addendum_change` list (with `affects_key`). Conflicts computed at read time (`lib/tenders/addendum-conflicts.ts`): differing scalars, addendum-only values, and each change linked by BM25 to the main item (clear winner only). Real Nairobi addendum removes mandatory req. No. 27 (NCA 1/2 cert, main p.31).
- 2026-11-12 (step 3): `getDatabaseEnv()` (Supabase vars only) for DB access, so pages work without the LLM key; extraction route returns "Extraction is not configured: …".
- 2026-11-12 (step 3): New deps: `ai`, `@ai-sdk/google|openai|anthropic` (env-switchable provider), `unpdf`. shadcn: table, badge, alert, label.
- 2026-11-12 (step 4): In-document bid-security conflicts come from page text (amounts next to "tender security" / "bid bond"), not a second LLM pass. The same amount restated is not a conflict. Eligibility, mandatory requirements and technical scope are `<details>` closed by default.
- 2026-11-12 (step 3 live): Listed models with the key. `gemini-2.5-flash` is closed to new users. `gemini-3.6-flash` accepts `additionalProperties: false` but the free tier is 20 requests/day and was used up probing. Live model is `gemini-3.5-flash-lite` (thinkingLevel `minimal`; 3.7/3.8 reject `minimal`). Gemini rejects `maxItems` on our array schema, so the 60-item cap is applied after the answer. SDK `maxRetries: 0`; one extra retry on a demand error. Link-styled buttons set `nativeButton={false}`.

## Next
- Step 4 remaining: readiness match (never invent a certificate), payment-risk card, rule-based recommendation + human decision, Vercel deploy.
- Human correction of an extracted field (keep `original_value`) is still not built. Quote check already runs in extraction.

## Known issues / open questions
- Free-tier Gemini: `gemini-3.6-flash` is 20 requests/day (exhausted while choosing a model). Live calls use `gemini-3.5-flash-lite`. A demand spike retries once.
- Field inserts are chunked (200) without a transaction; a mid-insert failure could leave partial fields on a failed run (runs are ~<200 fields, so one chunk in practice).
- Scanned PDFs (e.g. Nyamira advert, 0 text): run fails with a clear "no text layer, OCR not available" message. OCR is a later step.
- PGlite schema test applies only 0001; 0002 verified by hand in PGlite + live push. Add it to the test.
- MsingiAI Sauti endpoint, auth format and limits: get from the challenge owner.
- Ask mentors: must both intake options (field + procurement) be shown, or is one deep enough?
- Vercel project not linked; Vercel env vars must use the project URL with no path.
- `npm audit`: 12 low/moderate advisories in dev tooling; not triaged.
- With Cache Components, visited routes stay mounted but hidden (React Activity); tests must query `:visible`.
- 2025 CoB CSV labels Kakamega/Narok `MISSING` (no ageing); stored as `flagged` with the note.
- npm held back esbuild's postinstall (allowScripts); tsx works regardless.

## Log
- 2026-11-12 10:10 — Step 4a: "What matters" card (max 5 points) on Nairobi and Makueni. In-document bid-security conflict is code over page text (Nairobi p.7 KSh 420,000 vs p.30 KSh 500,000). Eligibility, mandatory and scope lists are closed accordions with counts.
- 2026-11-12 08:40 — Step 3 done. Nairobi main 68 fields (57 confirmed, 3 blank, 5 inferred, 3 needs human) in ~10s; addendum 5 fields and 1 conflict (NCA req. 27, main p.31). Makueni 222 pages, 46 fields (39 confirmed, 3 blank, 3 inferred, 1 needs human) in ~14s. Five spot-checks matched. Evidence panel highlights the quote and opens the PDF at that page.
- 2026-11-12 07:58 — Step 3a: upload, page text, extraction pipeline, tender pages. Live LLM run was blocked (no key yet).
- 2026-11-12 06:25 — Step 2b: linked + `db push --remote` (0001_init) + seeded live. Verified by SQL: 1 company, 74 capabilities, 15 leads, 295 fields (295 quote-confirmed), 94 CoB rows, 47 county risk; re-seed idempotent; publishable key reads 0 rows (RLS). Fixed `.env.local` URL (had `/rest/v1/`). 52 tests; build/lint/typecheck clean.
- 2026-11-12 05:00 — Step 2: `0001_init.sql` (14 tables, RLS, guards), `lib/risk/{county-score,margin,round}.ts`, `lib/verify/quote-check.ts`, `supabase/seed/*` + `npm run db:seed [-- --dry-run]`. 49 tests (incl. PGlite schema+seed). build/lint/typecheck clean.
- 2026-11-12 04:15 — Step 1: Next.js skeleton, shadcn sidebar shell (5 placeholder pages), §3 folders, .env.example, zod env loader + 5 Vitest tests. build/lint/typecheck/test clean.
- 2026-11-12 03:30 — Docs created: AGENTS.md, PRD.md, ARCHITECTURE.md, MEMORY.md.
