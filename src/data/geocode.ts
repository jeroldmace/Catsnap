import type { GeoPoint } from '../core/types';

/**
 * Read typed coordinates, e.g. "29.5603, 106.5776", "29.56 106.57",
 * "29.56N 106.57E", "29°33'N 106°34'E" is not supported (decimals only).
 * Works offline. Returns null if the text isn't coordinates.
 */
export function parseCoordinates(text: string): GeoPoint | null {
  const t = text.trim().toUpperCase().replace(/°/g, ' ');
  const m = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*([EW])?$/);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lng = parseFloat(m[3]);
  if (m[2] === 'S') lat = -Math.abs(lat);
  if (m[4] === 'W') lng = -Math.abs(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export interface Place extends GeoPoint { label: string }

/**
 * Look up a typed place or address with OpenStreetMap's Nominatim service.
 * Only runs when the user presses Search (their usage policy forbids
 * search-as-you-type). The search text goes to OpenStreetMap.
 */
export async function searchPlaces(query: string, near?: GeoPoint | null): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const coords = parseCoordinates(q);
  if (coords) return [{ ...coords, label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` }];
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '0', 'accept-language': navigator.language || 'en' });
  if (near) {
    const d = 0.5; // prefer results within ~50 km of you, but don't exclude others
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(res.status === 429 ? 'Too many searches. Wait a moment and try again.' : "Place search isn't available right now. Try typing coordinates instead.");
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return rows.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name }));
}
