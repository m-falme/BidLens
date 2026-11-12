-- 0003_sources_bucket: private Storage bucket for original uploaded files (ARCHITECTURE §2).
-- Private, so files are reachable only through the service role or short-lived signed URLs.
-- PDF only for now; later steps extend allowed_mime_types for images and audio.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sources', 'sources', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
