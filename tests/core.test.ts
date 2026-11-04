import { describe, expect, it } from 'vitest';
import { blurPoint, distanceKm, formatDistance, movePoint, offsetKm } from '../src/core/geo';
import { pointsFor, rarityOf, totalSightings } from '../src/core/rules';
import { demoSnaps } from '../src/core/demo';
import type { Snap } from '../src/core/types';

const here = { lat: 49.2827, lng: -123.1207 };

describe('geo', () => {
  it('measures distances', () => {
    const p = movePoint(here, 3, 4);
    expect(distanceKm(here, p)).toBeCloseTo(5, 1);
    const o = offsetKm(here, p);
    expect(o.x).toBeCloseTo(3, 1);
    expect(o.y).toBeCloseTo(4, 1);
  });
  it('blurs every point between 30 m and 100 m away', () => {
    for (let i = 0; i < 500; i++) {
      const d = distanceKm(here, blurPoint(here)) * 1000;
      expect(d).toBeGreaterThanOrEqual(29);
      expect(d).toBeLessThanOrEqual(101);
    }
  });
  it('formats distances', () => {
    expect(formatDistance(0.004)).toBe('10 m');
    expect(formatDistance(0.29)).toBe('290 m');
    expect(formatDistance(2.345)).toBe('2.3 km');
    expect(formatDistance(14.2)).toBe('14 km');
  });
});

describe('rarity', () => {
  it('rewards remote habitats and few sightings', () => {
    expect(rarityOf({ habitat: 'street', eyes: 'amber' }, 20).name).toBe('Common');
    expect(rarityOf({ habitat: 'street', eyes: 'amber' }, 1).name).toBe('Uncommon');
    expect(rarityOf({ habitat: 'attraction', eyes: 'amber' }, 2).name).toBe('Rare');
    expect(rarityOf({ habitat: 'wild', eyes: 'amber' }, 1).name).toBe('Legendary');
    expect(rarityOf({ habitat: 'wild', eyes: 'odd' }, 1).name).toBe('Legendary'); // capped
  });
  it('drifts toward Common as a cat is seen a lot', () => {
    expect(rarityOf({ habitat: 'harbour', eyes: 'green' }, 3).tier).toBe(2);
    expect(rarityOf({ habitat: 'harbour', eyes: 'green' }, 10).tier).toBe(1);
    expect(rarityOf({ habitat: 'harbour', eyes: 'green' }, 16).tier).toBe(0);
  });
});

describe('points', () => {
  it('counts own snaps by rarity plus 5 per logged sighting', () => {
    const demo = demoSnaps(here, 'you', '/', 0);
    const mine: Snap = { ...demo[1], id: 'm1', source: 'mine', habitat: 'wild', eyes: 'amber', crowd: { likes: 0, sightings: 0, comments: [] } };
    const ix = {
      m1: { snapId: 'm1', liked: false, comments: [], sightings: [] },
      s2: { snapId: 's2', liked: true, comments: [], sightings: [{ ...here, at: 1, by: 'you' }, { ...here, at: 2, by: 'you' }] },
    };
    expect(totalSightings(mine, ix.m1)).toBe(1);
    expect(pointsFor([mine, ...demo], ix, 'you')).toBe(100 + 10);
  });
});

describe('demo content', () => {
  it('places demo cats around the given centre and features Claude', () => {
    const demo = demoSnaps(here, 'you', '/base/', Date.now());
    expect(demo[0].name).toBe('Claude');
    expect(demo[0].photoUrl).toBe('/base/demo/claude.jpg');
    expect(demo.length).toBe(13);
    for (const s of demo) expect(distanceKm(here, s.location)).toBeLessThan(10);
  });
});
