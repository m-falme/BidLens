-- 0012_document_file_removals: "Remove file" on the Evidence library.
--
-- document_files is insert-only, so a file is never deleted. Removing one records this row instead:
-- for that paper, files uploaded before the newest removal no longer count as its file. The files stay
-- in Storage and in document_files as history. A later upload counts again.
-- Insert-only too. Uses public.forbid_mutation() from 0005.

create table public.document_file_removals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  capability_id uuid not null references public.capabilities (id) on delete restrict
);

create index document_file_removals_capability_created_idx
  on public.document_file_removals (capability_id, created_at desc);

create trigger document_file_removals_no_update
  before update on public.document_file_removals
  for each row execute function public.forbid_mutation();

create trigger document_file_removals_no_delete
  before delete on public.document_file_removals
  for each row execute function public.forbid_mutation();

alter table public.document_file_removals enable row level security;
