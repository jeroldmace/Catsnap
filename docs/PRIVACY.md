# Privacy and security in Cat Snap

## Defaults
- **Snaps are shared in real time with exact locations** with other signed-in spotters. Privacy options are opt-in.
- **Without an account**, everything stays on the phone.

## Opt-in options
| Option | Where | What it does |
|---|---|---|
| Shared after 1 hour | Per snap, or as your default (Settings → Privacy) | Others see the snap an hour after you share it. The time is set by the server, so the app can't bypass it. |
| Private | Per snap, or as your default | Only you can see it. It's still backed up to your account. |
| Delay my repeat sightings | Settings → Privacy | Others see your "saw them again" pins an hour later. |
| Blur this location | Per snap, or Settings → Privacy → Blur my locations | Moves the saved pin to a random spot 30–100 m away. |

## Always on
- **Accurate pins:** a snap uses the most accurate GPS fix from the last minute. Owners can move a pin when editing.
- **Photo metadata stripped:** photos are re-encoded on the phone, which removes EXIF data, including embedded GPS.
- **Sign-in required:** signed-out visitors can't read anything. The database refuses them.
- **Server-enforced access rules** (row level security):
  - you can only create, change or delete your own snaps, likes, comments, sightings and photos
  - likes, comments, sightings and photos are only visible on snaps you're allowed to see
- **Server-controlled fields:** ownership and share timestamps are set by the server. The app is only allowed to write specific columns.
- **Private photo storage:** photos are served through short-lived signed links (1 hour).
- **Email kept private:** your email is only used for sign-in. Other spotters see your username only.
- **Delete my account** (Settings → Account) removes your account, snaps, sightings, likes, comments and photos from the server. Copies on your phone stay until you delete them there.
- **No third-party tracking:**
  - fonts are bundled
  - no analytics
  - the web build's Content Security Policy only allows connections to the Cat Snap Supabase project and OpenStreetMap tiles
  - the map tiles do reveal the map area you're viewing to OpenStreetMap; the Radar view avoids that
  - typing a place name to find a spot sends that text to OpenStreetMap's Nominatim search, only when you tap Search; typed coordinates never leave the phone

## Recommended Supabase dashboard settings
These can't be set from code. In your project's **Authentication** settings:
- Keep **Confirm email** on.
- Set a **minimum password length** of 10 or more. The app already enforces 10.
- Turn on **leaked password protection**, if your plan has it.
- Set the **Site URL** to where the web app is hosted, so confirmation links land somewhere friendly.

## Database
Schema and policies are in `supabase/migrations/`. `20261104050000_fix_photo_policy.sql` must be run once in the Supabase **SQL Editor** (see the file header).
