-- 0006_decisions: the human bid decision, plus the two figures used for profit.
--
-- bid_decisions is insert-only, same as stage_reviews. A later decision is a new row.
-- Access matches the other tables: RLS on, no policies. The server uses the service
-- role, which bypasses RLS. The triggers still refuse updates and deletes.
--
-- contract_value_kes and delivery_cost_kes stay null until someone enters them.
-- The recommendation does not invent a price.

alter table public.opportunities
  add column contract_value_kes numeric(14, 2) check (contract_value_kes >= 0),
  add column delivery_cost_kes numeric(14, 2) check (delivery_cost_kes >= 0);

create table public.bid_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tender_id uuid not null references public.opportunities (id) on delete restrict,
  recommended_label text not null check (recommended_label in (
    'consider_declining', 'resolve_blockers', 'seek_clarification', 'proceed_to_preparation'
  )),
  final_label text not null check (final_label in (
    'consider_declining', 'resolve_blockers', 'seek_clarification', 'proceed_to_preparation'
  )),
  action text not null check (action in ('approve', 'override')),
  reason text,
  reviewer_name text not null check (btrim(reviewer_name) <> ''),
  check (
    (action = 'approve' and final_label = recommended_label)
    or (
      action = 'override'
      and final_label <> recommended_label
      and reason is not null
      and btrim(reason) <> ''
    )
  )
);

create index bid_decisions_tender_created_idx on public.bid_decisions (tender_id, created_at desc);

create trigger bid_decisions_no_update
  before update on public.bid_decisions
  for each row execute function public.forbid_mutation();

create trigger bid_decisions_no_delete
  before delete on public.bid_decisions
  for each row execute function public.forbid_mutation();

alter table public.bid_decisions enable row level security;
