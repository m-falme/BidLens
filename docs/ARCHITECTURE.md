# ARCHITECTURE — BidLens
v1.0 · 12 Nov 2026 · Owner: Mark (engineering) · Read with `PRD.md`.

## 1. Principles
1. **One deployable.** Next.js does UI and server work. No separate backend for the MVP.
2. **LLM for language, code for truth.** The LLM extracts and drafts; code verifies quotes, does all maths and applies all rules.
3. **Evidence is data.** Every extracted value is a row with its source, page, quote, confidence and status, not a field in a JSON blob.
4. **Pure, tested core.** Risk score, margin maths, quote check, normalization and duplicate scoring are pure TS functions with unit tests.
5. **Fail soft.** Any AI or parse failure leads to `needs_human`, never a crash.

## 2. Stack
| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript (strict)** | UI + route handlers + server actions in one project |
| UI | **Tailwind + shadcn/ui**, **Recharts** for charts | Fast, clean, consistent |
| DB / files | **Supabase**: Postgres + Storage (bucket `sources`) | Free tier, SQL migrations, dashboard for debugging |
| AI | **Vercel AI SDK** (`ai`) with `generateText` + `Output.object({ schema })` and **zod**; provider via env (`LLM_PROVIDER` = `google` / `openai` / `anthropic`) | `generateObject` is deprecated in AI SDK 7. Same zod-validated output. Swap model by env |
| PDF text | **unpdf** (page-by-page text, serverless-safe) | Needed for page citations |
| OCR fallback | Vision-capable LLM on page images (or `tesseract.js` if no vision model) | Scanned tenders, notebook photos |
| Retrieval | In-memory **BM25** over page text (`wink-bm25-text-search` or ~60 lines hand-rolled) | Send only relevant pages to the LLM; cheaper and more accurate |
| Voice | **MsingiAI Sauti** STT and TTS over HTTPS (server-side) | Swahili / English / mixed speech |
| Tests | **Vitest** (unit), Playwright once per milestone (smoke) | Fast confidence |
| Hosting | **Vercel** (Fluid compute, `maxDuration` up to 300s on extraction routes) | Public link for judges |
| Repo | GitHub, shared with mentors | Required deliverable |

## 3. Folder layout
```
app/
  (dashboard)/
    page.tsx                 # Overview: pipeline counts, recent decisions
    leads/                   # Board + table, Form 1 capture, lead detail
    tenders/                 # Upload, list, tender detail (tabs: Fields · Readiness · Risk · Decision · Proposal)
    counties/                # 47-county dashboard
    proposals/               # Proposal list + editor
  api/
    tenders/[id]/extract/route.ts     # long-running extraction (maxDuration 300)
    leads/extract/route.ts            # notes / image / voice → Form 1 candidates
    voice/stt/route.ts  voice/tts/route.ts
lib/
  ai/
    client.ts               # provider selection, retries, logging
    prompts/                # extract-tender.v1.ts (versioned TS modules, not markdown files)
    schemas.ts              # zod schemas for every LLM output
  pdf/          parse.ts (unpdf → pages[]), ocr.ts
  retrieval/    bm25.ts
  verify/       quote-check.ts
  risk/         county-score.ts, margin.ts, recommend.ts, clauses.ts
  leads/        normalize.ts, duplicates.ts
  db/           supabase-server.ts, supabase-browser.ts, queries/*.ts
  voice/        sauti.ts
components/     evidence-chip.tsx, status-badge.tsx, risk-card.tsx, margin-table.tsx, ...
supabase/
  migrations/   0001_init.sql, ...
  seed/         seed.ts (loads data/ → tables)
data/           # source data (see §8)
docs/           # PRD, ARCHITECTURE, MEMORY
tests/          # vitest
```

## 4. Data model (Postgres)
All tables have `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`.

| Table | Key columns | Notes |
|---|---|---|
| `companies` | name, profile_json | One seeded row: Zanari Analytics |
| `capabilities` | company_id, kind (`service`/`tool`/`document`/`certification`/`experience`/`sector`), name, detail, evidence_ref, verified bool | From the profile. `met` must link here |
| `opportunities` | company_id, type (`procurement`/`field`), title, organization, location, sector, reference, deadline_at, submission_method, source_platform, source_url, retrieved_at, status (Zanari glossary), owner, next_action, follow_up_on, readiness_pct, buyer_county | The shared opportunity record for both options |
| `sources` | opportunity_id, kind (`pdf`/`text`/`image`/`audio`/`form`/`email`), role (`main`/`addendum`), storage_path, original_name, sha256, raw_text | Originals are never overwritten. An addendum is another source on the same opportunity |
| `source_pages` | source_id, page_no, text, is_scanned | Page text for citations and the quote check |
| `fields` | opportunity_id, key, ordinal, value, original_value, source_id, page_no, quote, confidence numeric, status (`source_confirmed`/`ai_inferred`/`blank_in_source`/`needs_human`), extraction_run_id, affects_key, edited_by, edited_at | One row per extracted value. `ordinal` orders list items. `affects_key` is set on addendum changes |
| `requirements` | opportunity_id, text, category (`mandatory`/`technical`/`financial`/`contractual`), page_no, quote, match (`met`/`missing`/`unclear`), capability_id null, rationale | Readiness |
| `county_pending_bills` | county, report_date, pending_total_kes_m, budget_kes_m, age_* buckets, ageing_total_kes_m, pct_over_2y, pct_over_3y, trend_pct, data_quality (`ok`/`flagged`/`not_disclosed`), data_notes, source, source_url, retrieved_at | From CoB CSVs (Jun 2025 + Jun 2026) |
| `county_risk` | county, pending_bills_id, score, band, confidence, part_a, part_b, part_c, reason, as_of | Computed by `lib/risk/county-score.ts`, stored for the dashboard |
| `risk_assessments` | opportunity_id, inputs_json (V, m, r, adv, f, s, ir), scenarios_json, breakeven_days, price_to_keep_margin_json, clause_flags_json, recommendation, reasons_json | One per run; keep history |
| `decisions` | opportunity_id, choice (`bid`/`bid_higher`/`ask_advance`/`skip`), note, decided_by, snapshot_json | Human decision log |
| `proposals` | opportunity_id, version int, brief_md, draft_md, status (`draft`/`in_review`/`approved`), placeholders_json | Editable, versioned |
| `activities` | opportunity_id, kind (`status_change`/`note`/`edit`/`duplicate_flag`), payload_json, actor | Audit trail and pipeline history |
| `duplicate_candidates` | opportunity_id, candidate_id, score, reasons_json, resolution (`open`/`not_duplicate`/`same`) | Never auto-merge |
| `extraction_runs` | source_id, provider, model, prompt_version, status (`running`/`succeeded`/`failed`), error, stats_json, finished_at | One log row per extraction. At most one running or succeeded run per source |

RLS: on for all tables. The demo uses the service role on the server only; the browser reads through server components/actions.

## 5. Pipelines
### 5.1 Tender extraction (`POST /api/tenders/:id/extract`)
```
PDF → Storage → unpdf → source_pages[] (flag pages with < 40 chars as scanned → OCR)
   → BM25 index over pages
   → for each field group (identity, dates, submission, securities, payment terms, eligibility, mandatory docs):
        top-k pages (k≈6) → LLM generateText + Output.object(schema, pages with [p.N] markers)
        → returns {key, value | null, page, quote, confidence}
   → quote-check(page_text, quote) → status
   → value null + clause template present → blank_in_source (e.g. "interest rate is ____")
   → addendum? → diff fields vs main doc → conflict flags
   → save fields + requirements
```
- Model output never sets `status`; code does.
- Run field groups in parallel (Promise.all, concurrency 3). Target < 60s for 150 pages.

### 5.2 Readiness matching
Requirements + capabilities → LLM proposes a match per requirement with `capability_id` and a rationale → code rejects any `met` without a valid `capability_id` (downgrade to `unclear`) → `readiness_pct = met / (met + missing + unclear)` over mandatory items.

### 5.3 Payment risk (pure code, no LLM)
- `county-score.ts` (0–100, higher = riskier):
  - **A. Ageing (≤50):** `0.5 × pct_over_2y`
  - **B. Size (≤30):** `min(30, 0.75 × pending_as_pct_of_budget)`
  - **C. Trend (≤20):** `0` if payables fell ≥10% YoY; `10` if within ±10%; `20` if rose ≥10%
  - Rounding: score = `round1(A + B + C)` on the exact parts, rounded once. Parts are shown as whole numbers with a "parts rounded" note (they may not sum to the score).
  - Bands: `<25 Low · 25–49 Moderate · 50–74 High · ≥75 Severe`. Confidence: `HIGH` (clean CoB data), `MEDIUM` (CoB flag / anomalies), `UNKNOWN` (no data → no score shown, not 0).
  - Expected: Nairobi 76.5 Severe (HIGH); Mombasa 64.3 High; Makueni 2.6 Low (MEDIUM). Unit-test these.
- `margin.ts` (inputs V, m, r, D, adv, f=1, s=0, ir=0):
  ```
  P = V·m;  C = V·(1−m);  F = max(0, C − adv·V)·f
  financing = F·r·D/365;  recovered = F·ir·D/365
  net = P − financing + recovered − s;  margin = net / V
  breakeven_days = (P − s) / (F·(r − ir)/365)          # = (P − s)/(F·r/365) when ir = 0
  price_to_keep_margin(D) = (C + financing − recovered + s) / (1 − m)
  ```
  (`ir` is netted so break-even agrees with `net`; identical to the original formulas when ir = 0.)
  Test case: V=8,000,000, m=0.14, r=0.16, adv=0 → D=60 net≈939,047; D=365 net≈19,200; D=730 net≈−1,081,600; breakeven≈371 days; price@365≈9,280,000. With adv=0.2 → breakeven≈484 days.
- `clauses.ts`: flags `interest_rate_blank`, `payment_days_blank`, `advance_absent`, `deadline_mismatch` (doc vs portal), `addendum_conflict`, `performance_security_blank`.
- `recommend.ts` (rules, thresholds are user settings, defaults shown):
  - **Skip:** mandatory `missing` that can't be fixed before the deadline, OR breakeven_days < typical-delay scenario for the band (Severe→730, High→365, Moderate→180, Low→60).
  - **Ask for advance / clarification:** margin < floor (default 5%) only at the high scenario, OR any blank payment clause.
  - **Bid at higher price:** margin < floor at the band scenario but `price_to_keep_margin` increase ≤ 20%.
  - **Bid:** otherwise.
  - Output: choice + reasons[] + clarification questions[] (from clause flags). An LLM may **phrase** the reasons; it may not change the choice.

### 5.4 Field lead extraction (`POST /api/leads/extract`)
Input: Form 1 / text / image / audio. Audio → Sauti STT → transcript (stored as a source). Image → vision LLM → transcript with uncertain spans. Then LLM → Form 1 candidate fields with confidence → `normalize.ts` (dates incl. "Fri" → next Friday from the capture date, phones to `+2547…`, org names, industry labels) → `duplicates.ts` (exact phone/email/reference = strong; normalized-name Jaro-Winkler ≥ 0.9 = likely) → user confirms → save.

### 5.5 Proposal generation
Approved inputs only: verified fields, `met` capabilities, service catalogue, confirmed needs. LLM fills the Zanari Section-7 outline. A post-check regex scans for currency amounts, "certified", "ISO", client names not in the inputs → replaces them with placeholders and lists them for review. Saved as a new version.

### 5.6 Voice (P2)
`/api/voice/stt` (audio in memory → Sauti → text; audio never persisted unless the user saves it as a source). `/api/voice/tts` (text → audio stream). Voice Q&A: transcript → intent → read-only tools (`getOpportunity`, `getRisk`, `getReadiness`) → answer that cites computed values only → TTS.

## 6. AI contract
- `lib/ai/client.ts` (server-only) builds the model from `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY`.
- `lib/ai/extract.ts`: `extractStructured` calls `generateText` with `Output.object({ schema })` (AI SDK 7; `generateObject` is deprecated). Temperature 0, timeout 45s, no SDK retry (a 429 must not be sent three times). One corrective retry when zod rejects the output, with the error appended. A demand/unavailable error gets one plain retry after 3s. Each attempt logs a JSON line: prompt version, model, tokens, latency.
- Prompts are versioned TypeScript modules in `lib/ai/prompts/` (for example `extract-tender.v1.ts`), not markdown files, so a deploy does not read prompt text from disk. The extraction run stores `prompt_version`.
- Prompts say: *"Use only the provided pages. If a value is not present, return null. The quote must be copied verbatim from the page. Never guess."*
- Pages are passed as `[p.12] <text>` blocks so citations are page-exact.
- The zod schema is strict (`additionalProperties: false`). Gemini 3.6/3.5 Flash accepts that. It rejects `maxItems` on these object arrays, so the 60-item cap is applied in code after the answer, not in the schema.
- Flash-Lite thinks unless `thinkingLevel` is `minimal`. That option is sent only for lite model ids (3.7 and 3.8 reject `minimal`). Live model (12 Nov 2026): `gemini-3.5-flash-lite`. `gemini-2.5-flash` is closed to new keys; `gemini-3.6-flash` is listed but the free tier is 20 requests/day.

## 7. Environment
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only
LLM_PROVIDER=google             # google | openai | anthropic
LLM_MODEL=                      # e.g. gemini-3.5-flash-lite (2.5-flash is closed to new keys)
LLM_API_KEY=                    # server only
SAUTI_API_URL=                  # from MsingiAI
SAUTI_API_KEY=                  # server only
```

## 8. Source data in `data/`
| Path | Content |
|---|---|
| `data/zanari/` | Company profile PDF, developer pack DOCX, sample workbook XLSX (synthetic leads, tenders, notebook notes, questionnaire, glossary) |
| `data/tenders/` | Real PDFs: Nairobi NCCG/IDE/T/039 SD-WAN + addendum 1 (6 Nov 2026), Makueni CRMIS (tender doc, ToRs, POS specs), Nyamira revenue system (advert, tender doc) |
| `data/county_pending_bills_cob_47_jun2025.csv`, `..._jun2026.csv` | 47 counties, CoB BIRR figures |
| `data/county_payment_risk_scores_demo.csv` | Reference scores to check `county-score.ts` |
| `data/ppip_ict_awards_2024_2026.csv` | ICT awards from the PPIP OCDS feed |
| (not in repo) | Primary CoB reports, PPADA 2015 (rev. 2022), PPADR 2020: links in `data/README.md` |
| `data/README.md` | Field definitions and caveats |

## 9. Known constraints
- CoB data is a 30 Jun snapshot of the **stock** of unpaid bills, not this supplier's payment speed. Say so on the card.
- PPIP OCDS feed has no document links; PDFs are uploaded manually.
- Sauti rate limits are unpublished; send WAV/16 kHz mono; test spoken numbers early.
