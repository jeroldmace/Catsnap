-- Security fix: usernames must never come from the sign-up form's metadata.
-- A "Username (optional)" field at sign-up could be autofilled with the
-- password, which then became a public username and sat in plain text in
-- auth user metadata (also copied into session tokens).

-- 1) Any profile whose username equals what was sent at sign-up gets a
--    neutral random name (the owner can choose a new one in the app).
update public.profiles p
set username = 'spotter-' || substr(md5(p.id::text || clock_timestamp()::text), 1, 6)
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data ? 'username'
  and lower(u.raw_user_meta_data ->> 'username') = p.username;

-- 2) Remove the sign-up username from auth metadata for everyone.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'username'
where raw_user_meta_data ? 'username';

-- 3) New accounts: random neutral username; ignore sign-up metadata and never
--    derive it from the email address (that would reveal part of the email).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := 'spotter-' || substr(md5(new.id::text || clock_timestamp()::text || random()::text), 1, 6);
    exit when not exists (select 1 from public.profiles p where p.username = candidate);
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
