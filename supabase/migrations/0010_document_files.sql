-- 0010_document_files: the file a company uploads for one item on the Evidence library.
--
-- Insert-only, like the other records of what a person did. A replacement is a new row; the earlier
-- file stays in Storage and in this table, and the newest row is the one shown.
-- Access matches the other tables: RLS on, no policies. The server uses the service role.
-- Uses public.forbid_mutation() from 0005.

create table public.document_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  capability_id uuid not null references public.capabilities (id) on delete restrict,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_name text not null check (btrim(original_name) <> ''),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);

create index document_files_capability_created_idx on public.document_files (capability_id, created_at desc);

create trigger document_files_no_update
  before update on public.document_files
  for each row execute function public.forbid_mutation();

create trigger document_files_no_delete
  before delete on public.document_files
  for each row execute function public.forbid_mutation();

alter table public.document_files enable row level security;
