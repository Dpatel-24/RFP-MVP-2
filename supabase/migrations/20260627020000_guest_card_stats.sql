-- Global guest trust stats for the hotel-side bid card.
--
-- A hotel's RLS (requests_hotel_read) only exposes its OWN hotel's requests, so a
-- direct count would undercount a guest's stays. This SECURITY DEFINER function
-- counts accepted/handled requests across ALL hotels to give the true total.
--
-- Privacy gate: it only returns stats for a guest who has at least one request at
-- a hotel owned by the caller (auth.uid()) — mirroring the guest_profiles
-- "guest_visible_to_hotel" policy, so it can't be used to enumerate arbitrary
-- guests. EXECUTE is granted to authenticated only.
create or replace function public.guest_card_stats(g_id uuid)
returns table (rating numeric, stays integer)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(gp.rating, 0)::numeric as rating,
    (select count(*)::int
       from requests r
      where r.guest_id = g_id
        and r.status in ('accepted', 'handled')) as stays
  from guest_profiles gp
  where gp.id = g_id
    and exists (
      select 1
      from requests rq
      join hotels h on h.id = rq.hotel_id
      where rq.guest_id = g_id
        and h.owner_user_id = auth.uid()
    );
$$;

revoke execute on function public.guest_card_stats(uuid) from public, anon;
grant execute on function public.guest_card_stats(uuid) to authenticated;
