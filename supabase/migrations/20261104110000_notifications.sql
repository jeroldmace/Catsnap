-- Notifications for snap owners: likes, comments and sightings on their cats.
-- "New cats near you" is computed on the phone (the server never learns where
-- you are). Background polling uses a per-device key, not the login session.

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,   -- recipient (snap owner)
  actor_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'sighting')),
  snap_id uuid not null references public.snaps (id) on delete cascade,
  created_at timestamptz not null default now(),
  visible_at timestamptz not null default now(),   -- delayed sightings wait an hour
  read_at timestamptz
);
create index notifications_user_id_idx on public.notifications (user_id, id desc);
create index notifications_actor_id_idx on public.notifications (actor_id);
create index notifications_snap_id_idx on public.notifications (snap_id);

alter table public.notifications enable row level security;
create policy "see your own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()) and visible_at <= now());
create policy "mark your own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete your own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Create notifications from likes, comments and sightings (never for your own actions).
create or replace function private.notify_snap_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  k text := case tg_table_name when 'likes' then 'like' when 'comments' then 'comment' else 'sighting' end;
  vis timestamptz := now();
begin
  select s.owner_id into owner from public.snaps s where s.id = new.snap_id;
  if owner is null or owner = new.user_id then return new; end if;
  if tg_table_name = 'sightings' and new.delayed then vis := new.recorded_at + interval '1 hour'; end if;
  insert into public.notifications (user_id, actor_id, kind, snap_id, visible_at)
  values (owner, new.user_id, k, new.snap_id, vis);
  return new;
end;
$$;
revoke execute on function private.notify_snap_owner() from public, anon, authenticated;

create trigger likes_notify after insert on public.likes for each row execute function private.notify_snap_owner();
create trigger comments_notify after insert on public.comments for each row execute function private.notify_snap_owner();
create trigger sightings_notify after insert on public.sightings for each row execute function private.notify_snap_owner();

-- Un-liking removes the unread like notification.
create or replace function private.unnotify_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.kind = 'like' and n.snap_id = old.snap_id and n.actor_id = old.user_id and n.read_at is null;
  return old;
end;
$$;
revoke execute on function private.unnotify_like() from public, anon, authenticated;
create trigger likes_unnotify after delete on public.likes for each row execute function private.unnotify_like();

-- Per-device keys for background checks. Only a SHA-256 hash is stored.
create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index notification_devices_user_id_idx on public.notification_devices (user_id);
alter table public.notification_devices enable row level security;
create policy "register your own devices" on public.notification_devices
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "see your own devices" on public.notification_devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "remove your own devices" on public.notification_devices
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notification_devices from anon, authenticated;
grant select, delete on public.notification_devices to authenticated;
grant insert (token_hash) on public.notification_devices to authenticated;
