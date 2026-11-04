import exifr from 'exifr';
import type { GeoPoint } from '../core/types';

export interface PhotoMeta {
  /** Where the photo was taken, from its GPS tags (if the camera saved them). */
  location: GeoPoint | null;
  /** When it was taken (epoch ms), if recorded. */
  takenAt: number | null;
}

/**
 * Read the GPS position and capture time from a photo's metadata. Runs only on
 * the phone; the metadata is stripped from the copy that's saved or uploaded.
 */
export async function readPhotoMeta(file: Blob | ArrayBuffer | Uint8Array): Promise<PhotoMeta> {
  let location: GeoPoint | null = null;
  let takenAt: number | null = null;
  try {
    const gps = await exifr.gps(file as Blob);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)
      && Math.abs(gps.latitude) <= 90 && Math.abs(gps.longitude) <= 180
      && !(gps.latitude === 0 && gps.longitude === 0)) {
      location = { lat: gps.latitude, lng: gps.longitude };
    }
  } catch { /* no GPS metadata */ }
  try {
    const tags = await exifr.parse(file as Blob, ['DateTimeOriginal', 'CreateDate']);
    const d: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) takenAt = d.getTime();
  } catch { /* no date */ }
  return { location, takenAt };
}
