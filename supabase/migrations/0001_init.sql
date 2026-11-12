-- 0001_init: BidLens schema (docs/ARCHITECTURE.md §4).
--
-- Access model: the app reads and writes only from server code with the service role,
-- which bypasses RLS. RLS is enabled with no policies, so the anon key can read nothing.
--
-- Status vocabularies are text + CHECK constraints (not enums) so later migrations can
-- extend them without ALTER TYPE. Product rules from AGENTS.md §3 that the database can
-- enforce are enforced here, so a bug in app code cannot break them silently:
--   * a requirement is `met` only with a capability_id
--   * a field is `source_confirmed` only with source, page and quote
--   * the first edit of a field keeps the original value; original_value is then immutable
--   * a source's file hash, name and stored text are never overwritten
--   * decisions and activities are append-only

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function public.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: insert a new row instead of updating', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

-- ---------------------------------------------------------------------------
-- Company and capabilities
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null unique check (btrim(name) <> ''),
  profile_json jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_json) = 'object')
);

create table public.capabilities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('service', 'tool', 'document', 'certification', 'experience', 'sector')),
  name text not null check (btrim(name) <> ''),
  detail text,
  -- Where the capability is stated, e.g. 'zanari_company_profile.pdf p.7'.
  evidence_ref text,
  -- true = stated in a company-provided document cited by evidence_ref.
  verified boolean not null default false,
  unique (company_id, kind, name)
);

-- ---------------------------------------------------------------------------
-- Opportunities (procurement tenders and field leads share one record)
-- ---------------------------------------------------------------------------

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete restrict,
  type text not null check (type in ('procurement', 'field')),
  title text not null check (btrim(title) <> ''),
  organization text,
  location text,
  sector text,
  reference text,
  deadline_at timestamptz,
  submission_method text,
  source_platform text,
  source_url text,
  retrieved_at timestamptz,
  -- Zanari status glossary (zanari_sample_data.xlsx, Status_Glossary).
  status text not null default 'new' check (status in (
    'new', 'verification_required', 'potential', 'positive', 'discovery_scheduled', 'qualified',
    'proposal', 'awaiting_response', 'on_hold', 'not_qualified', 'won', 'lost'
  )),
  owner text,
  next_action text,
  follow_up_on date,
  readiness_pct numeric(5, 2) check (readiness_pct between 0 and 100),
  buyer_county text
);

create index opportunities_company_type_status_idx on public.opportunities (company_id, type, status);
create index opportunities_deadline_at_idx on public.opportunities (deadline_at);
create index opportunities_follow_up_on_idx on public.opportunities (follow_up_on);
create index opportunities_reference_idx on public.opportunities (reference);
create index opportunities_buyer_county_idx on public.opportunities (buyer_county);

-- ---------------------------------------------------------------------------
-- Sources (originals are never overwritten) and their page text
-- ---------------------------------------------------------------------------

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Nullable: a voice note or notebook photo can be captured before its opportunity exists.
  opportunity_id uuid references public.opportunities (id) on delete restrict,
  kind text not null check (kind in ('pdf', 'text', 'image', 'audio', 'form', 'email')),
  storage_path text,
  original_name text not null check (btrim(original_name) <> ''),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  raw_text text
);

create index sources_opportunity_id_idx on public.sources (opportunity_id);
create index sources_sha256_idx on public.sources (sha256);

create function public.sources_keep_original()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sha256 is distinct from old.sha256
     or new.original_name is distinct from old.original_name
     or new.kind is distinct from old.kind
     or (old.storage_path is not null and new.storage_path is distinct from old.storage_path)
     or (old.raw_text is not null and new.raw_text is distinct from old.raw_text) then
    raise exception 'sources are immutable once stored: upload a new source instead'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger sources_keep_original
  before update on public.sources
  for each row execute function public.sources_keep_original();

create table public.source_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_id uuid not null references public.sources (id) on delete cascade,
  page_no integer not null check (page_no > 0),
  text text not null,
  is_scanned boolean not null default false,
  unique (source_id, page_no)
);

-- ---------------------------------------------------------------------------
-- Extracted fields with evidence
-- ---------------------------------------------------------------------------

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  key text not null check (btrim(key) <> ''),
  value text,
  -- Set automatically on the first edit; null means the value was never edited.
  original_value text,
  source_id uuid references public.sources (id) on delete restrict,
  page_no integer check (page_no > 0),
  quote text,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  status text not null check (status in ('source_confirmed', 'ai_inferred', 'blank_in_source', 'needs_human')),
  edited_by text,
  edited_at timestamptz,
  constraint fields_confirmed_has_evidence check (
    status <> 'source_confirmed' or (source_id is not null and page_no is not null and quote is not null)
  ),
  constraint fields_blank_has_no_value check (status <> 'blank_in_source' or value is null)
);

-- Not unique per key: a main document and its addendum can both state a value; conflicts go to a human.
create index fields_opportunity_key_idx on public.fields (opportunity_id, key);
create index fields_source_id_idx on public.fields (source_id);
create index fields_status_idx on public.fields (status);

create function public.fields_keep_original()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.edited_at is not null and new.original_value is distinct from old.original_value then
    raise exception 'fields.original_value is immutable once set'
      using errcode = 'restrict_violation';
  end if;
  if new.value is distinct from old.value then
    if old.edited_at is null then
      new.original_value := old.value;
    end if;
    new.edited_at := pg_catalog.now();
  elsif new.edited_at is distinct from old.edited_at then
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

create trigger fields_keep_original
  before update on public.fields
  for each row execute function public.fields_keep_original();

-- ---------------------------------------------------------------------------
-- Readiness requirements
-- ---------------------------------------------------------------------------

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  text text not null check (btrim(text) <> ''),
  category text not null check (category in ('mandatory', 'technical', 'financial', 'contractual')),
  page_no integer check (page_no > 0),
  quote text,
  match text not null default 'unclear' check (match in ('met', 'missing', 'unclear')),
  capability_id uuid references public.capabilities (id) on delete restrict,
  rationale text,
  -- A public notice is not proof of eligibility: `met` must point at a capability record.
  constraint requirements_met_needs_capability check (match <> 'met' or capability_id is not null)
);

create index requirements_opportunity_id_idx on public.requirements (opportunity_id);
create index requirements_capability_id_idx on public.requirements (capability_id);

-- ---------------------------------------------------------------------------
-- County payment risk (public CoB data)
-- ---------------------------------------------------------------------------

create table public.county_pending_bills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  county text not null check (btrim(county) <> ''),
  report_date date not null,
  -- null when the county did not report (data_quality = 'not_disclosed'), never 0.
  pending_total_kes_m numeric(14, 2) check (pending_total_kes_m >= 0),
  budget_kes_m numeric(14, 2) check (budget_kes_m > 0),
  age_under_1y_kes_m numeric(14, 2) check (age_under_1y_kes_m >= 0),
  age_1_2y_kes_m numeric(14, 2) check (age_1_2y_kes_m >= 0),
  age_2_3y_kes_m numeric(14, 2) check (age_2_3y_kes_m >= 0),
  age_over_3y_kes_m numeric(14, 2) check (age_over_3y_kes_m >= 0),
  ageing_total_kes_m numeric(14, 2) check (ageing_total_kes_m >= 0),
  pct_over_2y numeric(5, 2) check (pct_over_2y between 0 and 100),
  pct_over_3y numeric(5, 2) check (pct_over_3y between 0 and 100),
  -- Year-on-year change in pending bills, %. null when no prior-year figure.
  trend_pct numeric(8, 2),
  data_quality text not null check (data_quality in ('ok', 'flagged', 'not_disclosed')),
  data_notes text,
  source text not null,
  source_url text not null,
  retrieved_at date,
  unique (county, report_date)
);

create index county_pending_bills_report_date_idx on public.county_pending_bills (report_date);

create table public.county_risk (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  county text not null check (btrim(county) <> ''),
  -- The CoB snapshot the score was computed from.
  pending_bills_id uuid not null references public.county_pending_bills (id) on delete cascade,
  score numeric(4, 1) check (score between 0 and 100),
  band text not null check (band in ('low', 'moderate', 'high', 'severe', 'unknown')),
  confidence text not null check (confidence in ('high', 'medium', 'unknown')),
  part_a numeric(4, 1) check (part_a between 0 and 50),
  part_b numeric(4, 1) check (part_b between 0 and 30),
  part_c numeric(4, 1) check (part_c in (0, 10, 20)),
  reason text,
  as_of date not null,
  unique (county, as_of),
  -- No data means no score (shown as "unknown"), never a score of 0.
  constraint county_risk_unknown_has_no_score check ((band = 'unknown') = (score is null))
);

create index county_risk_pending_bills_id_idx on public.county_risk (pending_bills_id);
create index county_risk_as_of_band_idx on public.county_risk (as_of, band);

-- ---------------------------------------------------------------------------
-- Risk runs, human decisions, proposals
-- ---------------------------------------------------------------------------

-- One row per run; history is kept, so no updated_at.
create table public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  inputs_json jsonb not null check (jsonb_typeof(inputs_json) = 'object'),
  scenarios_json jsonb not null check (jsonb_typeof(scenarios_json) = 'array'),
  -- null = financing never erodes the profit.
  breakeven_days numeric(10, 1) check (breakeven_days >= 0),
  price_to_keep_margin_json jsonb,
  clause_flags_json jsonb not null default '[]'::jsonb check (jsonb_typeof(clause_flags_json) = 'array'),
  recommendation text not null check (recommendation in ('bid', 'bid_higher', 'ask_advance', 'skip')),
  reasons_json jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons_json) = 'array')
);

create index risk_assessments_opportunity_created_idx on public.risk_assessments (opportunity_id, created_at desc);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  choice text not null check (choice in ('bid', 'bid_higher', 'ask_advance', 'skip')),
  note text,
  decided_by text not null check (btrim(decided_by) <> ''),
  -- What the human saw when deciding (risk card, readiness, fields).
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object')
);

create index decisions_opportunity_created_idx on public.decisions (opportunity_id, created_at desc);

create trigger decisions_append_only
  before update on public.decisions
  for each row execute function public.forbid_update();

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  version integer not null check (version > 0),
  brief_md text,
  draft_md text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved')),
  placeholders_json jsonb not null default '[]'::jsonb check (jsonb_typeof(placeholders_json) = 'array'),
  unique (opportunity_id, version)
);

-- ---------------------------------------------------------------------------
-- Audit trail and duplicate review
-- ---------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  kind text not null check (kind in ('status_change', 'note', 'edit', 'duplicate_flag')),
  payload_json jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_json) = 'object'),
  actor text not null check (btrim(actor) <> '')
);

create index activities_opportunity_created_idx on public.activities (opportunity_id, created_at desc);

create trigger activities_append_only
  before update on public.activities
  for each row execute function public.forbid_update();

-- Never auto-merge: a human resolves every candidate pair.
create table public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  candidate_id uuid not null references public.opportunities (id) on delete restrict,
  score numeric(4, 3) not null check (score between 0 and 1),
  reasons_json jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons_json) = 'array'),
  resolution text not null default 'open' check (resolution in ('open', 'not_duplicate', 'same')),
  constraint duplicate_candidates_distinct check (opportunity_id <> candidate_id),
  unique (opportunity_id, candidate_id)
);

create index duplicate_candidates_candidate_id_idx on public.duplicate_candidates (candidate_id);
create index duplicate_candidates_open_idx on public.duplicate_candidates (resolution) where resolution = 'open';

-- ---------------------------------------------------------------------------
-- updated_at triggers on records that get edited
-- ---------------------------------------------------------------------------

create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger capabilities_set_updated_at before update on public.capabilities
  for each row execute function public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger fields_set_updated_at before update on public.fields
  for each row execute function public.set_updated_at();
create trigger requirements_set_updated_at before update on public.requirements
  for each row execute function public.set_updated_at();
create trigger county_pending_bills_set_updated_at before update on public.county_pending_bills
  for each row execute function public.set_updated_at();
create trigger county_risk_set_updated_at before update on public.county_risk
  for each row execute function public.set_updated_at();
create trigger proposals_set_updated_at before update on public.proposals
  for each row execute function public.set_updated_at();
create trigger duplicate_candidates_set_updated_at before update on public.duplicate_candidates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: on everywhere, no policies (server uses the service role)
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.capabilities enable row level security;
alter table public.opportunities enable row level security;
alter table public.sources enable row level security;
alter table public.source_pages enable row level security;
alter table public.fields enable row level security;
alter table public.requirements enable row level security;
alter table public.county_pending_bills enable row level security;
alter table public.county_risk enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.decisions enable row level security;
alter table public.proposals enable row level security;
alter table public.activities enable row level security;
alter table public.duplicate_candidates enable row level security;
