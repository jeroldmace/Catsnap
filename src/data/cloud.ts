import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import type { Comment, Interaction, Snap, Visibility } from '../core/types';
import type { Repository } from './repository';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
let client: SupabaseClient | null = null;
export function cloud(): SupabaseClient {
  return (client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'catsnap-auth' },
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only real snaps (uuid ids) sync; the built-in example cat never leaves the device. */
export const isCloudId = (id: string) => UUID.test(id);

// ---------------------------------------------------------------------------
// Row shapes and mapping (pure, unit-tested)
// ---------------------------------------------------------------------------
export interface SnapRow {
  id: string;
  owner_id: string;
  name: string;
  coat: Snap['coat'];
  eyes: Snap['eyes'];
  habitat: Snap['habitat'];
  spot: string;
  notes: string;
  tags: string[];
  charm: number;
  fluff: number;
  pose: number;
  friendly: number;
  lat: number;
  lng: number;
  photo_path: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}
export interface PulledSnapRow extends SnapRow {
  profiles: { username: string } | null;
  likes: { user_id: string }[];
  comments: { id: string; user_id: string; body: string; created_at: string; profiles: { username: string } | null }[];
  sightings: { id: string; user_id: string; lat: number; lng: number; seen_at: string; delayed: boolean }[];
}

// Embeds name their foreign key explicitly: snaps and profiles are also linked
// indirectly through likes/comments/sightings, which PostgREST would otherwise
// reject as ambiguous (PGRST201).
export const SNAP_SELECT =
  'id, owner_id, name, coat, eyes, habitat, spot, notes, tags, charm, fluff, pose, friendly, lat, lng, photo_path, visibility, created_at, updated_at,' +
  ' profiles!snaps_owner_id_fkey(username), likes(user_id),' +
  ' comments(id, user_id, body, created_at, profiles!comments_user_id_fkey(username)),' +
  ' sightings(id, user_id, lat, lng, seen_at, delayed)';

/** Columns a client may write on insert (owner_id and shared_at are set by the server). */
export function snapInsertRow(s: Snap) {
  return {
    id: s.id,
    name: s.name, coat: s.coat, eyes: s.eyes, habitat: s.habitat, spot: s.spot, notes: s.notes, tags: s.tags,
    charm: s.ratings.charm, fluff: s.ratings.fluff, pose: s.ratings.pose, friendly: s.ratings.friendly,
    lat: s.location.lat, lng: s.location.lng,
    photo_path: s.photoPath ?? null,
    visibility: s.visibility ?? 'shared',
    created_at: new Date(s.createdAt).toISOString(),
    updated_at: new Date(s.updatedAt).toISOString(),
  };
}

/** Columns a client may change later. Location and creation time are fixed. */
export function snapUpdateRow(s: Snap) {
  const { id: _id, lat: _lat, lng: _lng, created_at: _c, ...rest } = snapInsertRow(s);
  return rest;
}

export interface PullResult {
  /** Other people's snaps. */
  community: Snap[];
  /** Your snaps as stored in the cloud (used to restore them on a new install). */
  mineRemote: Snap[];
  /** Your likes, comments and sightings as stored in the cloud, by snap id. */
  myInteractions: Record<string, Interaction>;
}

export function mapPulled(rows: PulledSnapRow[], myId: string): PullResult {
  const community: Snap[] = [];
  const mineRemote: Snap[] = [];
  const myInteractions: Record<string, Interaction> = {};

  for (const r of rows) {
    const mine = r.owner_id === myId;
    const author = r.profiles?.username ?? 'spotter';
    const othersSightings = r.sightings.filter((x) => x.user_id !== myId);
    const latest = othersSightings.reduce<PulledSnapRow['sightings'][number] | null>((a, x) => (!a || x.seen_at > a.seen_at ? x : a), null);
    const otherComments: Comment[] = r.comments
      .filter((c) => c.user_id !== myId)
      .map((c) => ({ id: c.id, by: c.profiles?.username ?? 'spotter', text: c.body, at: Date.parse(c.created_at), synced: true }))
      .sort((a, b) => a.at - b.at);

    const snap: Snap = {
      id: r.id,
      source: mine ? 'mine' : 'community',
      name: r.name, coat: r.coat, eyes: r.eyes, habitat: r.habitat, spot: r.spot, notes: r.notes, tags: r.tags ?? [],
      ratings: { charm: r.charm, fluff: r.fluff, pose: r.pose, friendly: r.friendly },
      author,
      createdAt: Date.parse(r.created_at),
      updatedAt: Date.parse(r.updated_at),
      location: { lat: r.lat, lng: r.lng },
      photoId: null,
      photoPath: r.photo_path,
      visibility: r.visibility,
      syncedAt: Date.parse(r.updated_at),
      crowd: {
        likes: r.likes.filter((l) => l.user_id !== myId).length,
        // The original snap counts as a sighting when it's someone else's.
        sightings: othersSightings.length + (mine ? 0 : 1),
        comments: otherComments,
        lastSighting: latest ? { id: latest.id, lat: latest.lat, lng: latest.lng, at: Date.parse(latest.seen_at), by: 'spotter', synced: true } : null,
      },
    };
    (mine ? mineRemote : community).push(snap);

    const myLike = r.likes.some((l) => l.user_id === myId);
    const myComments = r.comments.filter((c) => c.user_id === myId)
      .map((c) => ({ id: c.id, by: c.profiles?.username ?? 'you', text: c.body, at: Date.parse(c.created_at), synced: true }));
    const mySightings = r.sightings.filter((x) => x.user_id === myId)
      .map((x) => ({ id: x.id, lat: x.lat, lng: x.lng, at: Date.parse(x.seen_at), by: 'you', delayed: x.delayed, synced: true }));
    if (myLike || myComments.length || mySightings.length) {
      myInteractions[r.id] = { snapId: r.id, liked: myLike, likeSynced: myLike, comments: myComments, sightings: mySightings };
    }
  }
  return { community, mineRemote, myInteractions };
}

/**
 * Merge what the cloud knows about your interactions into the local copy
 * (local is newer for anything not yet synced).
 */
export function mergeInteraction(local: Interaction | undefined, remote: Interaction): Interaction {
  if (!local) return remote;
  const ids = new Set(local.comments.map((c) => c.id));
  const sids = new Set(local.sightings.map((x) => x.id).filter(Boolean));
  const likePending = local.likeSynced !== undefined && local.liked !== local.likeSynced;
  return {
    ...local,
    liked: likePending ? local.liked : remote.liked,
    likeSynced: remote.liked,
    comments: [...local.comments.map((c) => (remote.comments.some((r) => r.id === c.id) ? { ...c, synced: true } : c)),
      ...remote.comments.filter((c) => !ids.has(c.id))],
    sightings: [...local.sightings.map((x) => (remote.sightings.some((r) => r.id === x.id) ? { ...x, synced: true } : x)),
      ...remote.sightings.filter((x) => !sids.has(x.id))],
  };
}

// ---------------------------------------------------------------------------
// Push (upload local changes) and pull (download what you can see)
// ---------------------------------------------------------------------------
export type Tombstone = { kind: 'snap'; id: string; photoPath?: string | null } | { kind: 'photo'; path: string };
export const TOMBSTONES_KEY = 'cloud-tombstones';

const ignorable = (code?: string) => code === '23503' || code === '42501' || code === 'PGRST116';

export interface PushReport { snaps: Snap[]; interactions: Interaction[]; failures: number }

export async function pushChanges(repo: Repository, userId: string, mine: Snap[], interactions: Record<string, Interaction>, delaySightings: boolean): Promise<PushReport> {
  const sb = cloud();
  const changedSnaps: Snap[] = [];
  const changedIx: Interaction[] = [];
  let failures = 0;

  // 1) Deletions first.
  const tombs = (await repo.getMeta<Tombstone[]>(TOMBSTONES_KEY)) ?? [];
  const left: Tombstone[] = [];
  for (const t of tombs) {
    try {
      if (t.kind === 'snap') {
        const { error } = await sb.from('snaps').delete().eq('id', t.id);
        if (error) throw error;
        if (t.photoPath) await sb.storage.from(PHOTO_BUCKET).remove([t.photoPath]);
      } else {
        await sb.storage.from(PHOTO_BUCKET).remove([t.path]);
      }
    } catch { left.push(t); failures++; }
  }
  if (left.length !== tombs.length) await repo.putMeta(TOMBSTONES_KEY, left);

  // 2) New or edited snaps (photo first, then the row).
  for (const s of mine) {
    if (!isCloudId(s.id) || s.syncedAt === s.updatedAt) continue;
    try {
      let next = s;
      if (s.photoId && !s.photoPath) {
        const blob = await repo.getPhoto(s.photoId);
        if (blob) {
          const path = `${userId}/${s.photoId}.jpg`;
          const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (error && !/exists|duplicate/i.test(error.message)) throw error;
          next = { ...next, photoPath: path };
        }
      }
      const ins = await sb.from('snaps').insert(snapInsertRow(next));
      if (ins.error) {
        if (ins.error.code !== '23505') throw ins.error;
        const upd = await sb.from('snaps').update(snapUpdateRow(next)).eq('id', next.id);
        if (upd.error) throw upd.error;
      }
      next = { ...next, syncedAt: next.updatedAt };
      await repo.putSnap(next);
      changedSnaps.push(next);
    } catch { failures++; }
  }

  // 3) Likes, comments and sightings.
  for (const ix of Object.values(interactions)) {
    if (!isCloudId(ix.snapId)) continue;
    let next = ix;
    let dirty = false;
    try {
      if ((ix.likeSynced ?? false) !== ix.liked) {
        const res = ix.liked
          ? await sb.from('likes').insert({ snap_id: ix.snapId })
          : await sb.from('likes').delete().eq('snap_id', ix.snapId).eq('user_id', userId);
        if (res.error && res.error.code !== '23505' && !ignorable(res.error.code)) throw res.error;
        next = { ...next, likeSynced: ix.liked };
        dirty = true;
      }
      const comments = [];
      for (const c of next.comments) {
        if (c.synced) { comments.push(c); continue; }
        const { error } = await sb.from('comments').insert({ id: c.id, snap_id: ix.snapId, body: c.text });
        if (error && error.code !== '23505' && !ignorable(error.code)) throw error;
        comments.push({ ...c, synced: true });
        dirty = true;
      }
      const sightings = [];
      for (const x of next.sightings) {
        if (x.synced) { sightings.push(x); continue; }
        const id = x.id ?? crypto.randomUUID();
        const { error } = await sb.from('sightings').insert({
          id, snap_id: ix.snapId, lat: x.lat, lng: x.lng, seen_at: new Date(x.at).toISOString(), delayed: x.delayed ?? delaySightings,
        });
        if (error && error.code !== '23505' && !ignorable(error.code)) throw error;
        sightings.push({ ...x, id, synced: true });
        dirty = true;
      }
      next = { ...next, comments, sightings };
    } catch { failures++; }
    if (dirty) { await repo.putInteraction(next); changedIx.push(next); }
  }
  return { snaps: changedSnaps, interactions: changedIx, failures };
}

export async function pull(userId: string): Promise<PullResult> {
  const { data, error } = await cloud().from('snaps').select(SNAP_SELECT).order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(`Couldn't download snaps (${error.code ?? 'network'}). Your snaps are safe on this phone; sync will retry.`);
  return mapPulled((data ?? []) as unknown as PulledSnapRow[], userId);
}

/** Short-lived signed links for photos (private bucket). */
export async function signPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!paths.length) return out;
  const { data, error } = await cloud().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return out;
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export async function fetchUsername(userId: string): Promise<string | null> {
  const { data } = await cloud().from('profiles').select('username').eq('id', userId).maybeSingle();
  return data?.username ?? null;
}

export async function updateUsername(userId: string, username: string): Promise<string> {
  const { error } = await cloud().from('profiles').update({ username }).eq('id', userId);
  if (error) throw new Error(error.code === '23505' ? 'That username is taken.' : 'Usernames are 2–24 lowercase letters, numbers, dots, dashes or underscores.');
  return username;
}

/** Deletes your account, snaps, sightings, likes, comments and photos from the server. */
export async function deleteAccount(): Promise<void> {
  const { error } = await cloud().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw new Error("Couldn't delete your account right now. Check your connection and try again.");
  await cloud().auth.signOut({ scope: 'local' });
}
