-- Guest "saved hotels" (favourites). One row per (guest, hotel).
-- RLS: a guest can only read/write their OWN saved rows.
create table if not exists public.saved_hotels (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (guest_id, hotel_id)              -- enables the saveHotel() upsert
);

alter table public.saved_hotels enable row level security;

-- A guest may select/insert/delete only their own saved rows.
drop policy if exists saved_self_all on public.saved_hotels;
create policy saved_self_all on public.saved_hotels
  for all to authenticated
  using (auth.uid() = guest_id)
  with check (auth.uid() = guest_id);
