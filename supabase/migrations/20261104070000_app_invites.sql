-- Invite-only APK downloads for friends you choose.
-- Each friend gets a personal code; the get-app edge function checks it and
-- hands out a short-lived download link. Codes can be revoked or expired.
-- Only server-side code (service role) can read these; no client access.

create table public.app_invites (
  code text primary key check (code ~ '^[a-z0-9]{8,32}$'),
  label text not null check (char_length(label) between 1 and 60),   -- who it's for
  created_at timestamptz not null default now(),
  expires_at timestamptz,                                            -- null = no expiry
  revoked boolean not null default false,
  max_uses integer check (max_uses is null or max_uses > 0),         -- null = unlimited
  uses integer not null default 0,
  last_used_at timestamptz
);
alter table public.app_invites enable row level security;   -- no policies: clients get nothing
revoke all on public.app_invites from anon, authenticated;

-- Private bucket for release builds (served only via signed links from get-app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-releases', 'app-releases', false, 104857600, array['application/vnd.android.package-archive', 'application/json']);
