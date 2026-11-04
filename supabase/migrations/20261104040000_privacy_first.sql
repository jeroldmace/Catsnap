-- Sharing and opt-in privacy.
-- Default: snaps are shared with other signed-in spotters right away (real time).
-- Opt-in per snap:
--   'delayed' - shared, but others only see it one hour after sharing
--   'private' - only you can see it
-- Opt-in per sighting: delayed = true hides it from others for one hour.
-- Delay timestamps are set by the server, so the app can't fake them.
-- Likes, comments, sightings and photos are only visible on snaps you can see.

-- ---------- Snap visibility ----------
alter table public.snaps
  add column visibility text not null default 'shared' check (visibility in ('shared', 'delayed', 'private')),
  add column shared_at timestamptz;   -- set by the server, never by the client

create or replace function public.snaps_set_shared_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.visibility in ('shared', 'delayed') then
    if tg_op = 'INSERT' or old.visibility = 'private' then
      new.shared_at := now();
    else
      new.shared_at := old.shared_at;
    end if;
  else
    new.shared_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.snaps_set_shared_at() from public, anon, authenticated;

create trigger snaps_set_shared_at
  before insert or update on public.snaps
  for each row execute function public.snaps_set_shared_at();

create index snaps_shared_at_idx on public.snaps (shared_at desc) where visibility <> 'private';
create index snaps_photo_path_idx on public.snaps (photo_path) where photo_path is not null;

drop policy "snaps are visible to signed-in users" on public.snaps;
create policy "see own snaps and others' shared snaps" on public.snaps
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or visibility = 'shared'
    or (visibility = 'delayed' and shared_at <= now() - interval '1 hour')
  );

-- Clients may only write these columns (owner_id and shared_at are server-controlled).
revoke insert, update on public.snaps from authenticated;
grant insert (id, name, coat, eyes, habitat, spot, notes, tags, charm, fluff, pose, friendly, lat, lng, photo_path, visibility, created_at, updated_at)
  on public.snaps to authenticated;
grant update (name, coat, eyes, habitat, spot, notes, tags, charm, fluff, pose, friendly, photo_path, visibility, updated_at)
  on public.snaps to authenticated;

-- ---------- Sightings ----------
alter table public.sightings
  add column delayed boolean not null default false,
  add column recorded_at timestamptz not null default now();   -- server time

drop policy "sightings are visible to signed-in users" on public.sightings;
create policy "see own sightings and others' sightings on visible snaps" on public.sightings
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (not delayed or recorded_at <= now() - interval '1 hour')
      and exists (select 1 from public.snaps s where s.id = snap_id)
    )
  );
drop policy "users log their own sightings" on public.sightings;
create policy "users log their own sightings on snaps they can see" on public.sightings
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.snaps s where s.id = snap_id)
  );
revoke insert on public.sightings from authenticated;
grant insert (id, snap_id, lat, lng, seen_at, delayed) on public.sightings to authenticated;

-- ---------- Likes ----------
drop policy "likes are visible to signed-in users" on public.likes;
create policy "see likes on snaps you can see" on public.likes
  for select to authenticated
  using (exists (select 1 from public.snaps s where s.id = snap_id));
drop policy "users add their own likes" on public.likes;
create policy "users like snaps they can see" on public.likes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.snaps s where s.id = snap_id)
  );
revoke insert on public.likes from authenticated;
grant insert (snap_id) on public.likes to authenticated;

-- ---------- Comments ----------
drop policy "comments are visible to signed-in users" on public.comments;
create policy "see comments on snaps you can see" on public.comments
  for select to authenticated
  using (exists (select 1 from public.snaps s where s.id = snap_id));
drop policy "users add their own comments" on public.comments;
create policy "users comment on snaps they can see" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.snaps s where s.id = snap_id)
  );
revoke insert on public.comments from authenticated;
grant insert (id, snap_id, body) on public.comments to authenticated;

-- ---------- Photos follow their snap ----------
drop policy "signed-in users view snap photos" on storage.objects;
create policy "view your own photos and photos of snaps you can see" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'snap-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.snaps s where s.photo_path = name)
    )
  );
