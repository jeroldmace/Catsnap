import type { Interaction, Settings, Snap } from '../core/types';
import type { Repository } from './repository';
import { blobToDataUrl, dataUrlToBlob } from './photos';

export interface BackupFile {
  app: 'catsnap';
  version: 1;
  exportedAt: string;
  settings: Settings | null;
  snaps: Snap[];
  interactions: Interaction[];
  photos: Record<string, string>; // snap id -> data URL
}

export async function exportBackup(repo: Repository): Promise<Blob> {
  const { snaps, interactions, settings } = await repo.loadAll();
  const photos: Record<string, string> = {};
  for (const s of snaps) {
    if (!s.photoId) continue;
    const blob = await repo.getPhoto(s.photoId);
    if (blob) photos[s.photoId] = await blobToDataUrl(blob);
  }
  const file: BackupFile = {
    app: 'catsnap', version: 1, exportedAt: new Date().toISOString(),
    settings, snaps, interactions: Object.values(interactions), photos,
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** Merge a backup into the current data. Existing items with the same id are replaced. */
export async function importBackup(repo: Repository, text: string): Promise<{ snaps: number }> {
  let data: BackupFile;
  try { data = JSON.parse(text); } catch { throw new Error("That file isn't a Cat Snap backup."); }
  if (data?.app !== 'catsnap' || !Array.isArray(data.snaps)) throw new Error("That file isn't a Cat Snap backup.");
  for (const s of data.snaps) await repo.putSnap(s);
  for (const ix of data.interactions ?? []) await repo.putInteraction(ix);
  for (const [id, url] of Object.entries(data.photos ?? {})) await repo.putPhoto(id, await dataUrlToBlob(url));
  if (data.settings) await repo.putSettings(data.settings);
  return { snaps: data.snaps.length };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
