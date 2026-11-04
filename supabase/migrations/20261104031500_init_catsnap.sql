-- Cat Snap: shared field log for cats met out in the world.
-- Access model: everything requires sign-in. Signed-in users can read all
-- snaps, sightings, likes and comments (the shared radar/feed), but can only
-- create, change or delete their own rows. Locations are blurred on the
-- device before upload; exact GPS never reaches the database.

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_.-]{2,24}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (username);

-- ---------- Snaps (one row per cat entry) ----------
create table public.snaps (
  id uuid primary key,                                   -- generated on the device (offline-first)
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  coat text not null check (coat in ('orange','grey','brown','black','white','tuxedo','calico','tortie','bicolor','cream','siamese')),
  eyes text not null check (eyes in ('amber','green','blue','copper','odd')),
  habitat text not null check (habitat in ('street','shop','harbour','attraction','wild')),  -- no "home" on purpose
  spot text not null check (char_length(spot) between 1 and 60),
  notes text not null default '' check (char_length(notes) <= 400),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  charm smallint not null check (charm between 1 and 5),
  fluff smallint not null check (fluff between 1 and 5),
  pose smallint not null check (pose between 1 and 5),
  friendly smallint not null check (friendly between 1 and 5),
  lat double precision not null check (lat between -90 and 90),   -- blurred ~30-100 m
  lng double precision not null check (lng between -180 and 180),
  photo_path text,                                       -- object in the snap-photos bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index snaps_created_at_idx on public.snaps (created_at desc);
create index snaps_owner_id_idx on public.snaps (owner_id);

-- ---------- Sightings (repeat sightings of a cat) ----------
create table public.sightings (
  id uuid primary key,
  snap_id uuid not null references public.snaps (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  seen_at timestamptz not null default now()
);
create index sightings_snap_id_idx on public.sightings (snap_id);
create index sightings_user_id_idx on public.sightings (user_id);

-- ---------- Likes ----------
create table public.likes (
  snap_id uuid not null references public.snaps (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (snap_id, user_id)
);
create index likes_user_id_idx on public.likes (user_id);

-- ---------- Comments ----------
create table public.comments (
  id uuid primary key,
  snap_id uuid not null references public.snaps (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index comments_snap_id_idx on public.comments (snap_id);
create index comments_user_id_idx on public.comments (user_id);

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.snaps enable row level security;
alter table public.sightings enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "profiles are visible to signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "snaps are visible to signed-in users" on public.snaps
  for select to authenticated using (true);
create policy "users add their own snaps" on public.snaps
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "users update their own snaps" on public.snaps
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "users delete their own snaps" on public.snaps
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "sightings are visible to signed-in users" on public.sightings
  for select to authenticated using (true);
create policy "users log their own sightings" on public.sightings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users delete their own sightings" on public.sightings
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "likes are visible to signed-in users" on public.likes
  for select to authenticated using (true);
create policy "users add their own likes" on public.likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users remove their own likes" on public.likes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "comments are visible to signed-in users" on public.comments
  for select to authenticated using (true);
create policy "users add their own comments" on public.comments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users delete their own comments" on public.comments
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Data API grants (explicit; nothing for anon) ----------
revoke all on public.profiles, public.snaps, public.sightings, public.likes, public.comments from anon;
revoke all on public.profiles, public.snaps, public.sightings, public.likes, public.comments from authenticated;
grant select on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;
grant select, insert, update, delete on public.snaps to authenticated;
grant select, insert, delete on public.sightings, public.likes, public.comments to authenticated;

-- ---------- Profile created on sign-up ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1)),
    '[^A-Za-z0-9_.-]', '', 'g'));
  if char_length(base) < 2 then base := 'spotter'; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    n := n + 1;
    candidate := base || '_' || n::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('snap-photos', 'snap-photos', false, 5242880, array['image/jpeg']);

-- Paths are "<user id>/<photo id>.jpg": you may only write inside your own folder.
create policy "signed-in users view snap photos" on storage.objects
  for select to authenticated using (bucket_id = 'snap-photos');
create policy "users upload photos to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'snap-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users replace photos in their own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'snap-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'snap-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete photos in their own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'snap-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
