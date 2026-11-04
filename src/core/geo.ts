import type { GeoPoint } from './types';

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Offset in km east (x) / north (y) of `origin`. Good enough for a few dozen km. */
export function offsetKm(origin: GeoPoint, p: GeoPoint): { x: number; y: number } {
  return { x: (p.lng - origin.lng) * 111.32 * Math.cos(toRad(origin.lat)), y: (p.lat - origin.lat) * 110.57 };
}

export function movePoint(origin: GeoPoint, eastKm: number, northKm: number): GeoPoint {
  return {
    lat: origin.lat + northKm / 110.57,
    lng: origin.lng + eastKm / (111.32 * Math.cos(toRad(origin.lat))),
  };
}

/**
 * Blur a point to protect cats: a random point between 30 m and `radiusM`
 * from the original, so the exact spot is never stored or shared.
 */
export function blurPoint(p: GeoPoint, radiusM = 100, rand: () => number = Math.random): GeoPoint {
  const dist = (30 + rand() * (radiusM - 30)) / 1000;
  const angle = rand() * 2 * Math.PI;
  return movePoint(p, Math.cos(angle) * dist, Math.sin(angle) * dist);
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d} d ago`;
  return new Date(ts).toLocaleDateString();
}
