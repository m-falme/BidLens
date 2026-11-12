-- 0008_action_items: owner, due date and done tick for the preparation plan.
--
-- The plan itself is rebuilt in code from extracted fields. These rows keep only
-- what a person sets. A later extraction does not erase an owner or a tick: the
-- app upserts on (tender_id, item_key) and leaves other keys untouched.
--
-- Access matches the other tables: RLS on, no policies. The server uses the
-- service role, which bypasses RLS. Unlike stage reviews, these rows can be
-- updated, because Done, the owner and the due date change.

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tender_id uuid not null references public.opportunities (id) on delete restrict,
  item_key text not null check (btrim(item_key) <> ''),
  kind text not null check (kind in ('document', 'question', 'outline', 'date')),
  owner_name text check (owner_name is null or btrim(owner_name) <> ''),
  due_on date,
  done boolean not null default false,
  unique (tender_id, item_key)
);

alter table public.action_items enable row level security;
