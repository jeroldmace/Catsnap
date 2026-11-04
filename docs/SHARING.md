# Sharing the Android app with friends

Downloads are invite-only. Each friend gets a personal link:

```
https://mkabxvbkfwntlpxtoyus.supabase.co/functions/v1/get-app?code=<their code>
```

Opening it on an Android phone downloads the latest Cat Snap APK. The link checks the code, counts the download, then redirects to a private download URL that expires after 10 minutes. The app file itself sits in a private storage bucket (`app-releases`) and is never public.

## Add, revoke or limit invites
In the Supabase dashboard, open **Table Editor → app_invites**, or the **SQL Editor**:

```sql
-- New invite (prints the code to send)
insert into public.app_invites (code, label)
values (encode(extensions.gen_random_bytes(8), 'hex'), 'Sam')
returning code;

-- Optional limits on an invite
update public.app_invites set max_uses = 3, expires_at = now() + interval '14 days' where label = 'Sam';

-- Revoke
update public.app_invites set revoked = true where label = 'Sam';

-- Who has downloaded
select label, uses, last_used_at, revoked from public.app_invites order by created_at;
```

Or just ask Claude to add or revoke a friend.

## What friends need to know
- **Android only.** iPhones can't install APKs.
- When Android asks, allow **Install unknown apps** for their browser.
- They create their own Cat Snap account in the app. Your invite only grants the download, not access to anyone's data.
- **Updates:** each field-test build has a new signing key. To update, they open the same link again, uninstall the old app, then install the new one. Snaps synced to their account come back after signing in.

## Publishing a new build
`supabase/functions/publish-release` accepts a new APK (POST with the version) and replaces `catsnap-latest.apk`. It's protected by an upload token whose SHA-256 is in the function source. The token itself is never committed; rotating it means redeploying the function with a new hash.
