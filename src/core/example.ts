import type { GeoPoint, Snap } from './types';

/**
 * The one built-in example cat, so a fresh install isn't empty. It lives only
 * on the device: it's never uploaded, never placed on the radar, and has no
 * made-up likes or comments. Can be hidden in Settings.
 */
export const EXAMPLE_ID = 'example-not-claude';

export function exampleSnap(here: GeoPoint, photoBase: string, firstRun: number): Snap {
  return {
    id: EXAMPLE_ID,
    source: 'example',
    featured: true,
    name: 'Not-Claude',
    coat: 'orange',
    eyes: 'amber',
    habitat: 'harbour',
    spot: 'Riverside boardwalk, by the cat park',
    notes: 'Strolled up on the wet boardwalk, climbed straight onto a knee and demanded chin scratches. Tail curled up the whole time.',
    tags: ['Curious', 'Chatty', 'Sunbather'],
    ratings: { charm: 5, fluff: 4, pose: 4, friendly: 5 },
    author: 'catsnap',
    createdAt: firstRun,
    updatedAt: firstRun,
    location: here,
    photoUrl: `${photoBase}demo/claude.jpg`,
    crowd: { likes: 0, sightings: 1, comments: [] },
    visibility: 'private',
  };
}

/** Cities for Plus travel mode (radar preview elsewhere). */
export const CITIES: ({ key: string; label: string } & GeoPoint)[] = [
  { key: 'istanbul', label: 'Istanbul', lat: 41.0256, lng: 28.9741 },
  { key: 'chongqing', label: 'Chongqing', lat: 29.5603, lng: 106.5776 },
  { key: 'kyoto', label: 'Kyoto', lat: 35.0037, lng: 135.7788 },
  { key: 'valletta', label: 'Valletta', lat: 35.8989, lng: 14.5146 },
  { key: 'lisbon', label: 'Lisbon', lat: 38.7139, lng: -9.1334 },
  { key: 'hydra', label: 'Hydra', lat: 37.3496, lng: 23.4664 },
];

/** Where the map sits before the first GPS fix. */
export const FALLBACK_CENTER = { lat: 41.0256, lng: 28.9741, label: 'Istanbul' };

export const ADS = [
  { brand: 'Ridgeline Outfitters', line: 'Trail-ready daypacks for weekend wanderers.', cta: 'Shop daypacks', hue: '#2f6b4f' },
  { brand: 'Harbour Lights Ferries', line: 'Island hopping all summer. Cat-spotting optional.', cta: 'See timetable', hue: '#1f5d8a' },
  { brand: 'Paws Across Borders', line: 'Fund TNR programs that keep street cats healthy.', cta: 'Donate', hue: '#8a4b1f' },
];
