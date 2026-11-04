-- Fix: in "photos only for snaps you can see", the unqualified `name` resolved
-- to snaps.name instead of storage.objects.name, so other people could never
-- see photos of shared snaps (fail-safe, but wrong). Qualify the column.
drop policy "photos only for snaps you can see" on storage.objects;
create policy "photos only for snaps you can see" on storage.objects
  as restrictive
  for select to authenticated
  using (
    bucket_id <> 'snap-photos'
    or (storage.foldername(objects.name))[1] = (select auth.uid())::text
    or exists (select 1 from public.snaps s where s.photo_path = objects.name)
  );
