-- 0004_company_documents: checklist status for company papers (step 4).
--
--   * capabilities.holding is what the team says about a paper: have, dont_have, expired.
--     Services and tools leave it null. An optional expiry date is allowed only when they
--     hold it or it has expired.
--   * self_declared marks a Have that was not checked against a file.
--   * The first change to holding is copied into original_holding, which then stays put.
--   * requirements.match gains to_prepare for forms the bidder fills in and signs.
--     Those are not gaps and they are not proof the company already holds something.

alter table public.capabilities
  add column holding text,
  add column expires_on date,
  add column self_declared boolean not null default false,
  add column original_holding text;

alter table public.capabilities
  add constraint capabilities_holding_check
    check (holding is null or holding in ('have', 'dont_have', 'expired')),
  add constraint capabilities_original_holding_check
    check (original_holding is null or original_holding in ('have', 'dont_have', 'expired')),
  -- `holding in (...)` is unknown when holding is null, and a CHECK allows unknown.
  -- The case expression returns false for that, so a service cannot carry an expiry date.
  add constraint capabilities_expiry_when_held
    check (
      case
        when expires_on is null then true
        when holding in ('have', 'expired') then true
        else false
      end
    );

create function public.capabilities_keep_holding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.original_holding is not null and new.original_holding is distinct from old.original_holding then
    raise exception 'capabilities.original_holding is immutable once set'
      using errcode = 'restrict_violation';
  end if;
  if new.holding is distinct from old.holding then
    if old.original_holding is null then
      new.original_holding := old.holding;
    end if;
  elsif new.original_holding is distinct from old.original_holding then
    new.original_holding := old.original_holding;
  end if;
  return new;
end;
$$;

create trigger capabilities_keep_holding
  before update on public.capabilities
  for each row execute function public.capabilities_keep_holding();

alter table public.requirements drop constraint requirements_match_check;

alter table public.requirements
  add constraint requirements_match_check
    check (match in ('met', 'missing', 'unclear', 'to_prepare'));
