# 🐾 Cat Snap

A field log for **cats you meet out in the world**: strays, trail cats, harbour cats, temple and museum residents, market mousers. You can snap them, rate them and track them on the Cat Radar. Pets at home are deliberately out of scope.

This is the **field-test build (v0.5)**. It's an installable web app (PWA) that runs on your phone with real GPS, the real camera and a street map. It keeps all data on the phone. It's laid out so the same core can grow into a 1.0 with shared accounts and a native app (see [docs/ROADMAP.md](docs/ROADMAP.md)).

## Get it on your phone

The app needs HTTPS for GPS and the camera, so it has to be hosted. Pick one option:

| Option | Steps | Works for private repos |
|---|---|---|
| **Netlify** (recommended) | Sign in at netlify.com with GitHub → *Add new site → Import from Git* → pick `catsnap` and this branch. `netlify.toml` already sets the build. | Yes, free |
| **GitHub Pages** | Merge to `main`, then *Settings → Pages → Source: GitHub Actions*. The workflow in `.github/workflows/deploy-pages.yml` builds, tests and deploys. | Public repos on the free plan |
| **Your computer** | `npm install` then `npm run dev:phone`. Open the `https://<your-computer-ip>:5173` address on your phone (same Wi-Fi) and accept the self-signed certificate warning. | n/a |

On the phone, use **Share → Add to Home Screen** (iPhone, Safari) or **⋮ → Install app** (Android, Chrome). It then opens full screen and works offline.

See [docs/FIELD_TESTING.md](docs/FIELD_TESTING.md) for a test checklist.

## Features

- **Feed:** featured find (Claude 🧡), sort by Recent / Nearby / Top rated / Rare finds, filter by habitat.
- **Snap:** take a photo or pick one from the library, then add the name, coat, eyes, habitat, spot, 4-part paw rating, personality and notes. Requires the "met outside, not a pet" confirmation. You can edit or delete it later.
- **Saw them again:** log a repeat sighting instead of creating a duplicate. The radar shows where a cat was last seen, and repeat sightings feed into rarity.
- **Cat Radar:** an OpenStreetMap street map or a radar view, range and age filters, and a nearby list. Map tiles you've viewed are cached for offline use.
- **Catdex:** your snaps, points, rank and badges.
- **Plus (mock):** pricing screen, and Free vs Plus limits (ads; 10/25 km range; 7/30-day history; rarity filter; travel mode). No payment is taken.
- **Settings:** username, demo cats on/off, Plus toggle, location status, storage status, **backup/restore** (a JSON file that includes photos), and delete all data.

### Cat safety and privacy
- Every saved location is blurred to a random point 30–100 m away. The exact GPS position is never stored.
- Photos are re-encoded on the phone, which strips EXIF metadata, including the GPS position phones embed.
- There's no "home" habitat, and posting requires a "not a pet" confirmation.

## Development

```bash
npm install
npm run dev        # local dev server
npm run dev:phone  # HTTPS on your network, for testing on a phone
npm test           # unit tests (core rules, geo, storage)
npm run build      # type-check + production build into dist/
```

### Project layout
```
src/core/   Pure TypeScript: types, catalog, rarity and points rules, geo, demo content, cat sketches.
            No browser APIs, so it can be reused by a native app or a server.
src/data/   Repository interface + IndexedDB implementation, photo processing, backup/restore.
            Swap in a Supabase repository later without touching the UI.
src/ui/     React screens and components, app state (store.tsx), styles.
tests/      Vitest unit tests.
prototype/  The original single-file clickable prototype, kept for reference.
```
