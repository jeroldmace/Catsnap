import { HABITATS, RATING_KEYS } from './catalog';
import type { Interaction, Ratings, Snap } from './types';

export interface Rarity { name: 'Common' | 'Uncommon' | 'Rare' | 'Legendary'; points: number; tier: 0 | 1 | 2 | 3 }
export const RARITY: Rarity[] = [
  { name: 'Common', points: 10, tier: 0 },
  { name: 'Uncommon', points: 25, tier: 1 },
  { name: 'Rare', points: 50, tier: 2 },
  { name: 'Legendary', points: 100, tier: 3 },
];

/**
 * Rarity rewards hard-to-find cats: remote habitats score higher, odd eyes are
 * a bonus, and cats many people have logged drift toward Common.
 */
export function rarityOf(snap: Pick<Snap, 'habitat' | 'eyes'>, sightings: number): Rarity {
  let score = HABITATS[snap.habitat]?.weight ?? 0;
  if (sightings <= 3) score += 1;
  if (sightings > 15) score -= 1;
  if (snap.eyes === 'odd') score += 1;
  return RARITY[Math.max(0, Math.min(3, score))];
}

export const overallScore = (r: Ratings) =>
  RATING_KEYS.reduce((a, k) => a + (r[k.key] || 0), 0) / RATING_KEYS.length;

/** Points: rarity points for each of your own snaps, +5 for each extra sighting you log. */
export function pointsFor(snaps: Snap[], interactions: Record<string, Interaction>, me: string): number {
  const own = snaps.filter((s) => s.source === 'mine');
  const ownPts = own.reduce((a, s) => a + rarityOf(s, totalSightings(s, interactions[s.id])).points, 0);
  const logged = Object.values(interactions).reduce((a, ix) => a + ix.sightings.filter((x) => x.by === me).length, 0);
  return ownPts + logged * 5;
}

export function totalSightings(s: Snap, ix?: Interaction): number {
  const base = s.source === 'mine' ? 1 : Math.max(1, s.crowd.sightings);
  return base + (ix?.sightings.length ?? 0);
}

export function rankFor(points: number): string {
  if (points >= 500) return 'Legendary Cat Whisperer';
  if (points >= 200) return 'Seasoned Tracker';
  if (points >= 50) return 'Alley Explorer';
  return 'Rookie Spotter';
}

/** Free vs Plus limits. Location blur is identical for both tiers by design. */
export const TIERS = {
  free: { radiusKm: [1, 3], ageH: [1, 24], rarityFilter: false, travel: false, ads: true },
  plus: { radiusKm: [1, 3, 10, 25], ageH: [1, 24, 168, 720], rarityFilter: true, travel: true, ads: false },
} as const;
