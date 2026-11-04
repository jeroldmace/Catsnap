import { Capacitor, registerPlugin } from '@capacitor/core';
import type { GeoPoint } from '../core/types';

interface CatPhotoPlugin {
  pick(): Promise<{ path: string; mime?: string; original?: boolean; lat?: number; lng?: number }>;
}
const CatPhoto = registerPlugin<CatPhotoPlugin>('CatPhoto');

/**
 * Android app: pick a gallery photo with its original metadata (so its GPS
 * location can be read). Returns null if the user cancelled.
 */
export async function pickGalleryPhoto(): Promise<{ blob: Blob; location: GeoPoint | null; original: boolean } | null> {
  let r;
  try { r = await CatPhoto.pick(); }
  catch (e) {
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return null;
    throw e;
  }
  const blob = await (await fetch(Capacitor.convertFileSrc(r.path))).blob();
  // Remove the temporary copy (best effort).
  import('@capacitor/filesystem').then(({ Filesystem }) => Filesystem.deleteFile({ path: `file://${r.path}` })).catch(() => {});
  const location = typeof r.lat === 'number' && typeof r.lng === 'number' ? { lat: r.lat, lng: r.lng } : null;
  return { blob: r.mime ? new Blob([blob], { type: r.mime }) : blob, location, original: !!r.original };
}
