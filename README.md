# 🐾 Cat Snap — prototype

A social app for photographing, describing and rating **cats you meet out in the world**: strays, trail cats, harbour cats, temple and museum residents, market mousers. Pets at home are deliberately out of scope.

## Run it

No build step. Serve the folder with any static server and open it on your phone or in a mobile-sized browser window:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

> Geolocation needs `localhost` or HTTPS. If location is denied, the radar falls back to a demo city (Istanbul).

## What's in the prototype

| Area | What it does |
|---|---|
| **Feed** | Sort snaps by Recent / Nearby / Top rated / Rare finds, and filter by habitat. Like, comment, open details. |
| **Cat Radar** 📡 | A map centred on you that shows recently snapped cats. Filter by radius (1/3/10 km) and age (1 h / 24 h / 7 d). Pins snapped in the last hour pulse. Pins are colour-coded by rarity, and there's a list of nearby cats sorted by distance. |
| **Snap** 📸 | Take or upload a photo (it's resized on the device). You can also skip the photo and get an auto-drawn sketch. Add a name, coat, eyes, habitat, spot name, 4-part paw rating, personality tags and field notes. |
| **Catdex** 📖 | Your snaps, points, rank and badges (Trail Blazer, Culture Cat, Salty Paws, Legend Hunter…). |
| **Cat detail** | Ratings, traits, notes, comments, an "I spotted them too" co-sighting button, and "Show on radar". |

### Keeping it about cats out in the world
- **No "home" habitat.** The only choices are Street & Alley, Shop & Market, Harbour & Coast, Attraction, and Wild & Trail.
- **Posting rules** sit at the top of the Snap form, and you have to tick a confirmation saying the cat isn't your pet or someone's indoor cat.
- **Rarity rewards hard finds.** Remote habitats score higher. Cats with few sightings score higher. Cats that lots of people have logged drift toward *Common*. Points go Common 10 → Uncommon 25 → Rare 50 → Legendary 100.
- **Cat safety.** Posted locations are blurred by about 100 m so no one can find a specific cat's exact spot.

## Tech notes
- Plain HTML/CSS/JS. Maps use [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles.
- Data is stored in the browser's `localStorage`. The demo sightings are placed around your current location, so the radar always has something to show.
- Files: `index.html`, `css/styles.css`, `js/data.js` (habitats, coats, rarity rules, demo sightings, SVG cat sketches), `js/app.js` (UI logic).

## Possible next steps
- Real backend and accounts (e.g. Supabase or Firebase) with photo storage
- Use photo EXIF/GPS to check location, and an on-device "is this a cat / is this indoors?" check
- Group repeat sightings of the same cat automatically (by coat, location and photo similarity)
- Moderation and reporting, plus hiding sensitive locations (colonies, TNR sites)
- Wrap as a PWA or a React Native app for camera-first capture
