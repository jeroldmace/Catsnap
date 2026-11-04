# Road to Cat Snap 1.0

## Where we are (v0.5 field test)
An installable web app with on-device storage. Core rules (`src/core`) and storage (`src/data/repository.ts`) are separate from the UI.

## Steps to 1.0

1. **Field-test fixes (v0.6)**: act on notes from real outings. Tune the rarity rules and the blur radius.
2. **Accounts and a shared radar (v0.6, done)**: Supabase sign-in, offline-first sync, opt-in privacy (see PRIVACY.md). Next: PostGIS radius queries once there are many snaps, and realtime updates.
2b. *(original plan)*
   - Add a `supabaseRepository.ts` implementing `Repository`. It uses Postgres + PostGIS for "cats within X km", Storage for photos, and Auth for sign-in.
   - Write row-level security rules: everyone reads public snaps, only the owner edits theirs.
   - Store only blurred points. Add a delay or coarser rounding for brand-new snaps. Keep sensitive spots (colonies, TNR sites) off the radar.
   - Import existing on-device data from the backup file.
3. **Safety and moderation (v0.8)**: reporting, a review queue, an optional on-device "is this a cat / is this indoors?" check, and merging duplicate sightings of the same cat.
4. **Native app (v0.9)**
   - Expo (React Native) app reusing `src/core` unchanged and the repository interface.
   - Rebuild the screens with React Native components.
   - Add native camera, background-friendly location and push notifications (rare-cat alerts).
5. **Monetisation (1.0)**
   - Real Plus subscriptions (RevenueCat for app stores, or Stripe for web).
   - Ad network with category blocks (no breeders or pet sales).
   - Privacy policy, terms, and app store listings.

## Accounts you'll need along the way
- Supabase (free tier) for the shared backend
- Apple Developer ($99/yr) and Google Play ($25 once) for store releases
- RevenueCat / Stripe for payments
