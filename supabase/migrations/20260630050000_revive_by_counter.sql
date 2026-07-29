-- Revive-by-counter.
--
-- Problem: the response window is 60s and there is no out-of-band alerting yet,
-- so a hotel that isn't watching the dashboard misses the bid entirely. The row
-- is never lost (it stays visible in Reservations/KPIs), but it stops being
-- actionable, and the revenue is simply gone.
--
-- Fix: after expiry a hotel may still COUNTER a lapsed request. Countering
-- restamps a fresh guest window via the existing trg_stamp_counter_expiry
-- (120s), so the guest must accept again — their consent is always current.
-- Accepting or declining after expiry stays blocked.

create or replace function public.enforce_response_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- After expiry: countering is allowed (revival), accepting/declining is not.
  -- 5s grace absorbs round-trip latency for genuinely in-window clicks.
  if old.status in ('pending','countered')
     and new.status in ('accepted','declined')
     and old.expires_at is not null
     and old.expires_at < now() - interval '5 seconds' then
    raise exception 'This request has already expired.'
      using errcode = 'P0001';
  end if;

  -- Reviving a lapsed request must not leave a guest with two live requests.
  -- enforce_one_open_request only fires BEFORE INSERT, so an UPDATE-based
  -- revival would otherwise bypass the one-active-request invariant.
  if new.status = 'countered'
     and old.status is distinct from 'countered'
     and old.expires_at is not null
     and old.expires_at < now()
     and exists (
       select 1 from public.requests
       where guest_id = old.guest_id
         and id <> old.id
         and status in ('pending','countered')
         and expires_at > now()
     ) then
    raise exception 'This guest already has another active request.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- CREATE OR REPLACE preserves the existing ACL, but re-assert it so this
-- migration is safe to run against a database where the function is new.
revoke execute on function public.enforce_response_window() from public, anon, authenticated;
