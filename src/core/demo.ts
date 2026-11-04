import seed from './demoSeed.json';
import { movePoint } from './geo';
import type { GeoPoint, Snap } from './types';

/**
 * Demo cats are placed around wherever the viewer is, so the feed and radar
 * have something to show before real snaps exist. They can be switched off in Settings.
 */
export const CLAUDE_ID = 'claude';

export function demoSnaps(center: GeoPoint, username: string, photoBase: string, now = Date.now()): Snap[] {
  const claude: Snap = {
    id: CLAUDE_ID,
    source: 'demo',
    featured: true,
    name: 'Claude',
    coat: 'orange',
    eyes: 'amber',
    habitat: 'harbour',
    spot: 'Riverside boardwalk, by the cat park',
    notes: 'We named this one Claude. Strolled up on the wet boardwalk, climbed straight onto a knee and demanded chin scratches. Tail curled up the whole time.',
    tags: ['Curious', 'Chatty', 'Sunbather'],
    ratings: { charm: 5, fluff: 4, pose: 4, friendly: 5 },
    author: username,
    createdAt: now - 25 * 60000,
    updatedAt: now - 25 * 60000,
    location: movePoint(center, 0.08, 0.12),
    photoUrl: `${photoBase}demo/claude.jpg`,
    crowd: {
      likes: 64,
      sightings: 2,
      comments: [
        { id: 'c-claude-1', by: 'mira_on_foot', text: 'Claude! Instant favourite.', at: now - 20 * 60000 },
        { id: 'c-claude-2', by: 'snackhunter', text: 'That tail curl is unreal.', at: now - 12 * 60000 },
      ],
    },
  };

  const rest: Snap[] = seed.map((s) => ({
    id: s.id,
    source: 'demo',
    name: s.name,
    coat: s.coat as Snap['coat'],
    eyes: s.eyes as Snap['eyes'],
    habitat: s.habitat as Snap['habitat'],
    spot: s.spot,
    notes: s.notes,
    tags: s.tags,
    ratings: s.ratings as Snap['ratings'],
    author: s.author,
    createdAt: now - s.ago * 60000,
    updatedAt: now - s.ago * 60000,
    location: movePoint(center, s.dx, s.dy),
    crowd: {
      likes: s.likes,
      sightings: s.sightings,
      comments: s.comments.map((c, i) => ({ id: `c-${s.id}-${i}`, by: c.user, text: c.text, at: now - (s.ago - 5) * 60000 })),
    },
  }));
  return [claude, ...rest];
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

export const DEMO_CENTER = { lat: 41.0256, lng: 28.9741, label: 'Istanbul (demo)' };

export const ADS = [
  { brand: 'Ridgeline Outfitters', line: 'Trail-ready daypacks for weekend wanderers.', cta: 'Shop daypacks', hue: '#2f6b4f' },
  { brand: 'Harbour Lights Ferries', line: 'Island hopping all summer. Cat-spotting optional.', cta: 'See timetable', hue: '#1f5d8a' },
  { brand: 'Paws Across Borders', line: 'Fund TNR programs that keep street cats healthy.', cta: 'Donate', hue: '#8a4b1f' },
];
