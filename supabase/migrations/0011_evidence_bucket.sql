-- 0011_evidence_bucket: private Storage bucket for company evidence files.
-- Private, so files are reachable only through the service role or short-lived signed URLs.
-- PDF, PNG and JPEG up to 10 MB. The app also checks the real bytes after upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
