-- 0007_document_never_expires: an optional expiry date (step 6b).
--
--   * never_expires means the paper has no expiry date. KRA PIN, Certificate of
--     incorporation and CR12 start ticked. A date in the past is the only expiry.
--   * A ticked box cannot also store a date.

alter table public.capabilities
  add column never_expires boolean not null default false;

alter table public.capabilities
  add constraint capabilities_never_expires_has_no_date
    check (never_expires = false or expires_on is null);

update public.capabilities
set never_expires = true
where name in ('Certificate of incorporation', 'CR12', 'KRA PIN')
  and expires_on is null;
