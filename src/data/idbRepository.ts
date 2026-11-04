import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Interaction, Settings, Snap } from '../core/types';
import type { Repository } from './repository';

interface CatSnapDB extends DBSchema {
  snaps: { key: string; value: Snap; indexes: { createdAt: number } };
  photos: { key: string; value: Blob };
  interactions: { key: string; value: Interaction };
  meta: { key: string; value: unknown };
}

export function createIdbRepository(name = 'catsnap'): Repository {
  let dbp: Promise<IDBPDatabase<CatSnapDB>> | null = null;
  const db = () =>
    (dbp ??= openDB<CatSnapDB>(name, 1, {
      upgrade(d) {
        const snaps = d.createObjectStore('snaps', { keyPath: 'id' });
        snaps.createIndex('createdAt', 'createdAt');
        d.createObjectStore('photos');
        d.createObjectStore('interactions', { keyPath: 'snapId' });
        d.createObjectStore('meta');
      },
    }));

  return {
    async loadAll() {
      const d = await db();
      const [snaps, ixList, settings] = await Promise.all([
        d.getAll('snaps'),
        d.getAll('interactions'),
        d.get('meta', 'settings') as Promise<Settings | undefined>,
      ]);
      const interactions: Record<string, Interaction> = {};
      for (const ix of ixList) interactions[ix.snapId] = ix;
      return { snaps, interactions, settings: settings ?? null };
    },
    async putSnap(snap) { await (await db()).put('snaps', snap); },
    async deleteSnap(id) {
      const d = await db();
      const tx = d.transaction(['snaps', 'photos', 'interactions'], 'readwrite');
      await Promise.all([tx.objectStore('snaps').delete(id), tx.objectStore('photos').delete(id), tx.objectStore('interactions').delete(id), tx.done]);
    },
    async putPhoto(id, blob) { await (await db()).put('photos', blob, id); },
    async getPhoto(id) { return (await db()).get('photos', id); },
    async deletePhoto(id) { await (await db()).delete('photos', id); },
    async putInteraction(ix) { await (await db()).put('interactions', ix); },
    async putSettings(settings) { await (await db()).put('meta', settings, 'settings'); },
    async clearAll() {
      const d = await db();
      const tx = d.transaction(['snaps', 'photos', 'interactions', 'meta'], 'readwrite');
      await Promise.all([...(['snaps', 'photos', 'interactions', 'meta'] as const).map((s) => tx.objectStore(s).clear()), tx.done]);
    },
  };
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
