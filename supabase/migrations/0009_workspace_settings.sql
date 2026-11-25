-- 0009_workspace_settings: the switches and figures on the Settings page.
--
-- One row per company. The app falls back to the defaults below when the row is missing,
-- so a workspace that never opened Settings behaves exactly as before.
-- Access matches the other tables: RLS on, no policies; the server uses the service role.

create table public.workspace_settings (
  company_id uuid primary key references public.companies (id) on delete restrict,
  updated_at timestamptz not null default now(),
  -- Money assumptions. Annual loan rate used by the profit and delay scenarios (0.16 = 16%).
  financing_rate numeric(5, 4) not null default 0.16 check (financing_rate >= 0 and financing_rate <= 1),
  -- Review gates. The decision itself always needs a named person; this one adds a condition.
  require_stage_reviews boolean not null default false,
  -- Automation.
  auto_start_analysis boolean not null default true,
  -- Alerts. On screen only: BidLens never sends an email.
  alert_closing boolean not null default true,
  alert_closing_days integer not null default 7 check (alert_closing_days between 1 and 60),
  alert_documents boolean not null default true,
  alert_documents_days integer not null default 30 check (alert_documents_days between 1 and 365)
);

alter table public.workspace_settings enable row level security;
