import type { Interaction, Settings, Snap } from '../core/types';

/**
 * Everything the app needs from storage. The field-test build uses
 * IndexedDB on the phone (idbRepository). A shared backend (e.g. Supabase)
 * can implement this same interface later without touching the UI.
 */
export interface Repository {
  loadAll(): Promise<{ snaps: Snap[]; interactions: Record<string, Interaction>; settings: Settings | null }>;
  putSnap(snap: Snap): Promise<void>;
  deleteSnap(id: string): Promise<void>;
  putPhoto(id: string, blob: Blob): Promise<void>;
  getPhoto(id: string): Promise<Blob | undefined>;
  deletePhoto(id: string): Promise<void>;
  putInteraction(ix: Interaction): Promise<void>;
  putSettings(settings: Settings): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  putMeta(key: string, value: unknown): Promise<void>;
  clearAll(): Promise<void>;
}
