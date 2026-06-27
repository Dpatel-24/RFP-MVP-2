-- Room photos: adds rooms.image_url + a public "room-images" storage bucket
-- with owner-scoped write policies. Wired in lib/api.js via uploadRoomImage().
--
-- App upload path: "{hotelId}/{roomId}/{filename}" — so the FIRST folder
-- segment of a stored object's name is the hotel id, which the write policies
-- check against hotels.owner_user_id.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Column to hold the room's photo public URL.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.rooms
  add column if not exists image_url text;

-- owner_rooms() is "RETURNS SETOF rooms" with "select r.*", so it now returns
-- image_url automatically — no function change required.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Public storage bucket (public read so storage getPublicUrl() resolves).
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('room-images', 'room-images', true)
on conflict (id) do update set public = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Storage RLS on storage.objects (enabled by default in Supabase).
--    Public can read; only a hotel's owner can write under that hotel's folder.
-- ─────────────────────────────────────────────────────────────────────────────

-- Anyone can view room photos.
drop policy if exists "room-images public read" on storage.objects;
create policy "room-images public read"
  on storage.objects for select
  using ( bucket_id = 'room-images' );

-- Owner can upload into a path under a hotel they own.
drop policy if exists "room-images owner insert" on storage.objects;
create policy "room-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and h.owner_user_id = auth.uid()
    )
  );

-- Owner can replace/update their hotel's photos (upsert on re-upload).
drop policy if exists "room-images owner update" on storage.objects;
create policy "room-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and h.owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and h.owner_user_id = auth.uid()
    )
  );

-- Owner can delete their hotel's photos.
drop policy if exists "room-images owner delete" on storage.objects;
create policy "room-images owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and h.owner_user_id = auth.uid()
    )
  );
