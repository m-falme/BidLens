-- 0002_extraction: tender upload and evidence extraction (step 3).
--
--   * sources.role separates a tender's main document from its addenda, so conflicts between
--     them can be shown side by side instead of merged.
--   * extraction_runs logs every extraction (model, prompt version, per-group tokens and latency)
--     and guarantees at most one running or successful run per source.
--   * fields gain the run that produced them, an ordinal for list items (eligibility,
--     scope, ...) and, for addendum changes, the field key the change targets.
--   * source_pages.is_scanned keeps its meaning: the page has no text layer and needs OCR.

alter table public.sources
  add column role text not null default 'main' check (role in ('main', 'addendum'));

create index sources_opportunity_role_idx on public.sources (opportunity_id, role);

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_id uuid not null references public.sources (id) on delete restrict,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  provider text not null check (btrim(provider) <> ''),
  model text not null check (btrim(model) <> ''),
  prompt_version text not null check (btrim(prompt_version) <> ''),
  finished_at timestamptz,
  error text,
  -- Per field group: pages sent, tokens, latency, attempts, and whether the group failed.
  stats_json jsonb not null default '{}'::jsonb check (jsonb_typeof(stats_json) = 'object'),
  constraint extraction_runs_finished_has_time check (status = 'running' or finished_at is not null),
  constraint extraction_runs_failed_has_error check (status <> 'failed' or error is not null)
);

-- A second click (or a second tab) cannot start a duplicate run or re-extract a finished source.
create unique index extraction_runs_one_active_per_source
  on public.extraction_runs (source_id) where status in ('running', 'succeeded');
create index extraction_runs_source_created_idx on public.extraction_runs (source_id, created_at desc);

create trigger extraction_runs_set_updated_at before update on public.extraction_runs
  for each row execute function public.set_updated_at();

alter table public.extraction_runs enable row level security;

alter table public.fields
  add column extraction_run_id uuid references public.extraction_runs (id) on delete restrict,
  add column ordinal integer not null default 0 check (ordinal >= 0),
  add column affects_key text;

create index fields_extraction_run_id_idx on public.fields (extraction_run_id);
