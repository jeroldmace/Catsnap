import { registerPlugin } from '@capacitor/core';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { cloud } from './cloud';
import { isNative } from './platform';

interface CatNotifyPlugin {
  permission(): Promise<{ state: string }>;
  status(): Promise<{ permission: string; enabled: boolean }>;
  configure(o: { key: string; url: string; apikey: string; kinds: NotifyKinds; nearbyKm: number; since?: string; cursor?: number }): Promise<void>;
  setPosition(o: { lat: number; lng: number }): Promise<void>;
  markSeen(o: { cursor?: number; since?: string }): Promise<void>;
  checkNow(): Promise<void>;
  disable(): Promise<void>;
}
const CatNotify = registerPlugin<CatNotifyPlugin>('CatNotify');

export interface NotifyKinds { like: boolean; comment: boolean; sighting: boolean; nearby: boolean }

export interface ActivityItem {
  id: string;
  kind: 'like' | 'comment' | 'sighting' | 'nearby';
  text: string;
  snapId: string;
  at: number;
  read: boolean;
  serverId?: number;
}

const DEVICE_KEY = 'catsnap-notify-device';

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Turn on background notifications for this phone: ask for permission,
 * register a random device key (only its hash goes to the server) and start
 * the 15-minute background check. Returns false if the user said no.
 */
export async function enableBackgroundNotifications(kinds: NotifyKinds, nearbyKm: number, cursor: number): Promise<boolean> {
  if (!isNative()) return false;
  const { state } = await CatNotify.permission();
  if (state !== 'granted') return false;
  let key = localStorage.getItem(DEVICE_KEY);
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const { error } = await cloud().from('notification_devices').insert({ token_hash: await sha256Hex(key) });
    if (error && error.code !== '23505') throw new Error("Couldn't turn on notifications. Check your connection and try again.");
    localStorage.setItem(DEVICE_KEY, key);
  }
  await CatNotify.configure({ key, url: SUPABASE_URL, apikey: SUPABASE_PUBLISHABLE_KEY, kinds, nearbyKm, since: new Date().toISOString(), cursor });
  return true;
}

/** Stop background checks and revoke this phone's device key on the server. */
export async function disableBackgroundNotifications(): Promise<void> {
  const key = localStorage.getItem(DEVICE_KEY);
  if (key) {
    try { await cloud().from('notification_devices').delete().eq('token_hash', await sha256Hex(key)); } catch { /* offline: server key expires with the account */ }
    localStorage.removeItem(DEVICE_KEY);
  }
  if (isNative()) await CatNotify.disable().catch(() => {});
}

export const notifyStatus = () => (isNative() ? CatNotify.status() : Promise.resolve({ permission: 'unsupported', enabled: false }));
export const saveNotifyPosition = (lat: number, lng: number) => (isNative() ? CatNotify.setPosition({ lat, lng }).catch(() => {}) : Promise.resolve());
export const markNotifySeen = (o: { cursor?: number; since?: string }) => (isNative() ? CatNotify.markSeen(o).catch(() => {}) : Promise.resolve());

/** Your notifications from the server (likes, comments, sightings on your cats). */
export async function fetchServerActivity(): Promise<ActivityItem[]> {
  const { data, error } = await cloud().from('notifications')
    .select('id, kind, created_at, read_at, snap_id, snaps(name), profiles!notifications_actor_id_fkey(username)')
    .order('id', { ascending: false }).limit(60);
  if (error) return [];
  return (data as unknown as { id: number; kind: ActivityItem['kind']; created_at: string; read_at: string | null; snap_id: string; snaps: { name: string } | null; profiles: { username: string } | null }[])
    .map((n) => {
      const who = n.profiles?.username ?? 'Someone', cat = n.snaps?.name ?? 'your cat';
      return {
        id: `n${n.id}`, serverId: n.id, kind: n.kind, snapId: n.snap_id, at: Date.parse(n.created_at), read: !!n.read_at,
        text: n.kind === 'like' ? `@${who} liked ${cat}` : n.kind === 'comment' ? `@${who} commented on ${cat}` : `@${who} spotted ${cat} again`,
      };
    });
}

export async function markServerActivityRead(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await cloud().from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
}
