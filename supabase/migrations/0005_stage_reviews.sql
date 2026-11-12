-- 0005_stage_reviews: a human marks each assessment step as reviewed.
--
-- Insert only. A later review is a new row. Nothing here is updated or deleted,
-- so the rows are the start of the decision trail.
-- Access matches the other tables: RLS on, no policies. The server uses the
-- service role, which bypasses RLS. The triggers still refuse updates and deletes.

create function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is insert-only: this row cannot be changed or removed', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

create table public.stage_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tender_id uuid not null references public.opportunities (id) on delete restrict,
  stage text not null check (stage in ('can_bid', 'can_comply', 'should_bid')),
  reviewer_name text not null check (btrim(reviewer_name) <> ''),
  note text
);

create index stage_reviews_tender_created_idx on public.stage_reviews (tender_id, created_at desc);

create trigger stage_reviews_no_update
  before update on public.stage_reviews
  for each row execute function public.forbid_mutation();

create trigger stage_reviews_no_delete
  before delete on public.stage_reviews
  for each row execute function public.forbid_mutation();

alter table public.stage_reviews enable row level security;
