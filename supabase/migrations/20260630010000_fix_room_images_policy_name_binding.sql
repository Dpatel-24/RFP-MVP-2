-- FIX: room photo upload always failed with an RLS violation (storage 400).
--
-- Root cause: in 20260627000000_room_images.sql the policies used the
-- UNQUALIFIED column `name` inside the EXISTS subquery over public.hotels.
-- Postgres bound it to the nearest relation — hotels.name — not the intended
-- storage.objects.name (the upload path). foldername('<hotel display name>')
-- has no folder segments, so the ownership check never matched and every
-- insert/update/delete was denied for everyone (bucket stayed at 0 objects).
--
-- Fix: recreate all three policies with the path column explicitly qualified
-- as objects.name so the {hotelId} folder segment is read from the upload key.

drop policy if exists "room-images owner insert" on storage.objects;
create policy "room-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(objects.name))[1]
        and h.owner_user_id = auth.uid()
    )
  );

drop policy if exists "room-images owner update" on storage.objects;
create policy "room-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(objects.name))[1]
        and h.owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(objects.name))[1]
        and h.owner_user_id = auth.uid()
    )
  );

drop policy if exists "room-images owner delete" on storage.objects;
create policy "room-images owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(objects.name))[1]
        and h.owner_user_id = auth.uid()
    )
  );
