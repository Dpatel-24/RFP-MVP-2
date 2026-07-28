-- Instant-bid overhaul: server-authoritative response windows, one active
-- request per account, and a daily cleaner for expired rows.
--
-- Windows: 60s for a guest bid -> hotel response, 120s for a hotel counter ->
-- guest response. These intervals are mirrored in lib/api.js (TIMER_SECONDS /
-- COUNTER_TIMER) purely to drive the display countdown; the DB is authoritative.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. expires_at is set by the server, never the browser clock.
--    At a 60s window, client clock skew is proportionally 10x more damaging
--    than it was at 600s. submitBid() no longer sends the column.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.requests
  alter column expires_at set default (now() + interval '60 seconds');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sending a counter restamps the window server-side (120s).
--    hotelCounter() no longer sends expires_at.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.stamp_counter_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'countered' and old.status is distinct from 'countered' then
    new.expires_at := now() + interval '120 seconds';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_counter_expiry on public.requests;
create trigger trg_stamp_counter_expiry
  before update of status on public.requests
  for each row execute function public.stamp_counter_expiry();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enforce the response window server-side.
--    Covers hotel accept/decline/counter AND guest accept/decline of a counter.
--    5-second grace so a hotel clicking at 0:59 isn't punished for round-trip
--    latency. Transitions to 'expired' are deliberately NOT guarded so the
--    cleaner (below) can always run.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_response_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('pending','countered')
     and new.status in ('accepted','declined','countered')
     and old.expires_at is not null
     and old.expires_at < now() - interval '5 seconds' then
    raise exception 'This request has already expired.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_response_window on public.requests;
create trigger trg_enforce_response_window
  before update of status on public.requests
  for each row execute function public.enforce_response_window();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. One active request per ACCOUNT (previously a client-only, per-hotel rule).
--    SECURITY DEFINER so it sees the guest's rows across all hotels regardless
--    of RLS. Checks expires_at > now() rather than status alone, so a lapsed
--    row that the daily cleaner hasn't finalized yet can never wrongly block a
--    guest — this is what makes a once-a-day cleaner safe.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_one_open_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.requests
    where guest_id = new.guest_id
      and status in ('pending','countered')
      and expires_at > now()
  ) then
    raise exception 'You already have an active request. Wait for it to resolve before submitting another.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_one_open_request on public.requests;
create trigger trg_enforce_one_open_request
  before insert on public.requests
  for each row execute function public.enforce_one_open_request();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Daily cleaner so lapsed rows stop accumulating as permanently "open".
--    Nothing user-facing depends on this: effectiveStatus() already derives
--    "expired" live in the browser, and the guard above is expiry-aware. This
--    is DB hygiene only, which is why once a day is sufficient.
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists requests_open_expiry_idx
  on public.requests (status, expires_at)
  where status in ('pending','countered');

-- One-time backfill of rows that lapsed before this migration existed.
update public.requests
   set status = 'expired', resolved_at = now()
 where status in ('pending','countered')
   and expires_at < now();

create extension if not exists pg_cron;

select cron.unschedule('finalize-expired-requests')
 where exists (select 1 from cron.job where jobname = 'finalize-expired-requests');

select cron.schedule(
  'finalize-expired-requests',
  '5 4 * * *', -- 04:05 UTC daily
  $$update public.requests
       set status = 'expired', resolved_at = now()
     where status in ('pending','countered')
       and expires_at < now()$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger functions must not be reachable as PostgREST RPCs. Matches the
--    grants on the pre-existing trigger functions (postgres + service_role
--    only); without this the security advisor flags all three.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.enforce_one_open_request() from public, anon, authenticated;
revoke execute on function public.enforce_response_window() from public, anon, authenticated;
revoke execute on function public.stamp_counter_expiry() from public, anon, authenticated;
