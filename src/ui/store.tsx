import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CITIES, FALLBACK_CENTER, exampleSnap } from '../core/example';
import { bestFix, blurPoint, distanceKm, type TimedFix } from '../core/geo';
import { overallScore, pointsFor, rarityOf, totalSightings, type Rarity } from '../core/rules';
import { DEFAULT_SETTINGS, type Comment, type GeoPoint, type Interaction, type Settings, type Sighting, type Snap } from '../core/types';
import { exportBackup, importBackup } from '../data/backup';
import {
  TOMBSTONES_KEY, cloud, deleteAccount as cloudDeleteAccount, fetchUsername, isCloudId, mergeInteraction, pull, pushChanges,
  signPhotoUrls, updateUsername, type Tombstone,
} from '../data/cloud';
import { saveFile } from '../data/platform';
import { startLocation, type LocStatus } from '../data/location';
import { createIdbRepository, requestPersistentStorage } from '../data/idbRepository';
import type { Repository } from '../data/repository';
import { processPhoto } from '../data/photos';

export type GeoStatus = LocStatus;
export interface GeoState { status: GeoStatus; point: GeoPoint | null; accuracy: number | null; updatedAt: number | null; source?: string; detail?: string }
/** A snap's location must come from a fix at most this old (or be picked on the map). */
export const POST_FRESH_MS = 10 * 60 * 1000;

export type SyncState = 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatus { state: SyncState; lastSync: number | null; pending: number; message?: string }
export interface Account { id: string; email: string | null }

/** A snap plus everything derived for display. */
export interface SnapView extends Snap {
  likes: number;
  liked: boolean;
  comments: Comment[];
  sightingCount: number;
  mySightings: Sighting[];
  lastSeen: number;
  position: GeoPoint;
  rarity: Rarity;
  score: number;
  distanceKm: number;
  photoSrc: string | null;
}

export type SnapDraft = Omit<Snap, 'id' | 'source' | 'author' | 'createdAt' | 'updatedAt' | 'location' | 'photoId' | 'photoUrl' | 'photoPath' | 'crowd' | 'syncedAt'>;

interface Ctx {
  ready: boolean;
  settings: Settings;
  geo: GeoState;
  here: GeoPoint & { label?: string };
  radarCenter: GeoPoint & { label?: string };
  travel: (typeof CITIES)[number] | null;
  setTravel: (key: string | null) => void;
  snaps: SnapView[];
  points: number;
  persisted: boolean | null;
  toast: (msg: string) => void;
  toastMsg: string | null;
  account: Account | null;
  sync: SyncStatus;
  syncNow: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  changePassword: (password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setUsername: (name: string) => Promise<void>;
  addSnap: (draft: SnapDraft, photo: Blob | null, manualPoint?: GeoPoint | null) => Promise<string>;
  /** Most accurate fix from the last minute (what a new snap would use). */
  getBestFix: () => TimedFix | null;
  editSnap: (id: string, draft: SnapDraft, photo: Blob | null | undefined, moveTo?: GeoPoint | null) => Promise<void>;
  deleteSnap: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  logSighting: (id: string) => Promise<boolean>;
  exportData: () => Promise<'downloaded' | 'shared'>;
  importData: (file: File) => Promise<void>;
  resetAll: () => Promise<void>;
  requestLocation: () => void;
}

const StoreContext = createContext<Ctx | null>(null);
export const useStore = () => {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside provider');
  return c;
};

const uid = () => crypto.randomUUID();
const emptyIx = (snapId: string): Interaction => ({ snapId, liked: false, comments: [], sightings: [] });
const COMMUNITY_CACHE = 'community-cache';
const FIRST_RUN = 'first-run';
const LAST_POSITION = 'last-position';
const SYNC_EVERY_MS = 3 * 60 * 1000;

export function StoreProvider({ children, repo: injected }: { children: ReactNode; repo?: Repository }) {
  const repo = useMemo(() => injected ?? createIdbRepository(), [injected]);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mine, setMine] = useState<Snap[]>([]);
  const [community, setCommunity] = useState<Snap[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [cloudUrls, setCloudUrls] = useState<Record<string, string>>({});
  const [geo, setGeo] = useState<GeoState>({ status: 'pending', point: null, accuracy: null, updatedAt: null });
  const [travel, setTravelState] = useState<(typeof CITIES)[number] | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [firstRun, setFirstRun] = useState(() => Date.now());
  const [session, setSession] = useState<Session | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ state: 'signed-out', lastSync: null, pending: 0 });
  const toastTimer = useRef<number>();

  // Latest values for async sync code (avoids stale closures).
  const live = useRef({ mine, interactions, settings, session });
  live.current = { mine, interactions, settings, session };

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(t); }, []);

  // ---- Load from on-device storage ----
  const loadPhotos = useCallback(async (snaps: Snap[]) => {
    const urls: Record<string, string> = {};
    for (const s of snaps) {
      if (!s.photoId) continue;
      const blob = await repo.getPhoto(s.photoId);
      if (blob) urls[s.photoId] = URL.createObjectURL(blob);
    }
    setPhotoUrls((old) => { Object.values(old).forEach((u) => URL.revokeObjectURL(u)); return urls; });
  }, [repo]);

  const reload = useCallback(async () => {
    const data = await repo.loadAll();
    setMine(data.snaps.filter((s) => s.source === 'mine'));
    setInteractions(data.interactions);
    setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
    setCommunity((await repo.getMeta<Snap[]>(COMMUNITY_CACHE)) ?? []);
    let fr = await repo.getMeta<number>(FIRST_RUN);
    if (!fr) { fr = Date.now(); await repo.putMeta(FIRST_RUN, fr); }
    setFirstRun(fr);
    await loadPhotos(data.snaps);
  }, [repo, loadPhotos]);

  useEffect(() => {
    reload().catch(() => toast("Couldn't open on-device storage. Snaps won't be saved.")).finally(() => setReady(true));
    requestPersistentStorage().then(setPersisted);
  }, [reload, toast]);

  // ---- Location ----
  const stopLoc = useRef<(() => void) | null>(null);
  const recentFixes = useRef<TimedFix[]>([]);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const startWatch = useCallback(() => {
    stopLoc.current?.();
    setGeo((g) => (g.status === 'live' ? g : { ...g, status: 'pending' }));
    stopLoc.current = startLocation(
      // Keep the newest fix; an older cached position never replaces a newer one.
      (f) => {
        const now = Date.now();
        recentFixes.current = [...recentFixes.current.filter((x) => now - x.at < 120000), { lat: f.lat, lng: f.lng, accuracy: f.accuracy, at: Math.min(f.at, now) }];
        setGeo((g) => g.updatedAt && f.at < g.updatedAt && g.point ? { ...g, status: 'live' }
        : { status: 'live', point: { lat: f.lat, lng: f.lng }, accuracy: f.accuracy, updatedAt: f.at, source: f.source });
      },
      (status, detail) => setGeo((g) => ({ ...g, status: status === 'searching' && g.point ? 'live' : status, detail })),
    );
  }, []);
  useEffect(() => {
    startWatch();
    const onVisible = () => { if (document.visibilityState === 'visible' && geoRef.current.status !== 'live') startWatch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopLoc.current?.(); document.removeEventListener('visibilitychange', onVisible); };
  }, [startWatch]);

  // Remember the last position on this phone (only here, never uploaded) so maps
  // open near you even before a fresh GPS fix.
  const [lastKnown, setLastKnown] = useState<GeoPoint | null>(null);
  useEffect(() => { repo.getMeta<GeoPoint>(LAST_POSITION).then((p) => p && setLastKnown(p)).catch(() => {}); }, [repo]);
  const savedAt = useRef(0);
  useEffect(() => {
    if (!geo.point || Date.now() - savedAt.current < 60000) return;
    savedAt.current = Date.now();
    repo.putMeta(LAST_POSITION, geo.point).catch(() => {});
  }, [geo.point, repo]);
  const here = useMemo(() => geo.point ?? lastKnown ?? { ...FALLBACK_CENTER }, [geo.point, lastKnown]);
  const radarCenter = useMemo(() => (travel ? { lat: travel.lat, lng: travel.lng, label: travel.label } : here), [travel, here]);
  const setTravel = useCallback((key: string | null) => setTravelState(key ? CITIES.find((c) => c.key === key) ?? null : null), []);

  // ---- Cloud: session ----
  useEffect(() => {
    const sb = cloud();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const account = useMemo<Account | null>(() => (session ? { id: session.user.id, email: session.user.email ?? null } : null), [session]);

  // ---- Cloud: sync ----
  const syncing = useRef(false);
  const pendingCount = useCallback(() => {
    const { mine: m, interactions: ix } = live.current;
    let n = m.filter((s) => isCloudId(s.id) && s.syncedAt !== s.updatedAt).length;
    for (const i of Object.values(ix)) {
      if (!isCloudId(i.snapId)) continue;
      if ((i.likeSynced ?? false) !== i.liked) n++;
      n += i.comments.filter((c) => !c.synced).length + i.sightings.filter((x) => !x.synced).length;
    }
    return n;
  }, []);

  const syncNow = useCallback(async () => {
    const { session: s } = live.current;
    if (!s) { setSync({ state: 'signed-out', lastSync: null, pending: 0 }); return; }
    if (!navigator.onLine) { setSync((x) => ({ ...x, state: 'offline', pending: pendingCount() })); return; }
    if (syncing.current) return;
    syncing.current = true;
    setSync((x) => ({ ...x, state: 'syncing' }));
    const me = s.user.id;
    try {
      const { mine: m, interactions: ix, settings: st } = live.current;
      const pushed = await pushChanges(repo, me, m, ix, st.delaySightings);
      if (pushed.snaps.length) setMine((cur) => cur.map((x) => pushed.snaps.find((p) => p.id === x.id) ?? x));
      if (pushed.interactions.length) setInteractions((cur) => { const n = { ...cur }; for (const p of pushed.interactions) n[p.snapId] = p; return n; });

      const res = await pull(me);
      // Restore your own snaps that exist in the cloud but not on this phone (e.g. after a reinstall).
      const localIds = new Set(live.current.mine.map((x) => x.id));
      const tombs = (await repo.getMeta<Tombstone[]>(TOMBSTONES_KEY)) ?? [];
      const deleted = new Set(tombs.filter((t) => t.kind === 'snap').map((t) => (t as { id: string }).id));
      const restored = res.mineRemote.filter((x) => !localIds.has(x.id) && !deleted.has(x.id)).map((x) => ({ ...x, author: st.username }));
      for (const r of restored) await repo.putSnap(r);
      if (restored.length) setMine((cur) => [...restored, ...cur]);
      // Others' crowd numbers on your own snaps.
      setMine((cur) => cur.map((x) => { const r = res.mineRemote.find((y) => y.id === x.id); return r ? { ...x, crowd: r.crowd } : x; }));
      // Merge your remote likes/comments/sightings.
      const merged = Object.entries(res.myInteractions).map(([id, remote]) => mergeInteraction(live.current.interactions[id], remote));
      for (const i of merged) await repo.putInteraction(i);
      if (merged.length) setInteractions((cur) => { const n = { ...cur }; for (const i of merged) n[i.snapId] = i; return n; });

      setCommunity(res.community);
      await repo.putMeta(COMMUNITY_CACHE, res.community);
      const paths = [...res.community, ...res.mineRemote, ...restored].map((x) => x.photoPath).filter((p): p is string => !!p);
      setCloudUrls(await signPhotoUrls([...new Set(paths)]));

      const name = await fetchUsername(me);
      if (name && name !== live.current.settings.username) {
        const next = { ...live.current.settings, username: name };
        setSettings(next);
        await repo.putSettings(next);
      }
      setSync({ state: pushed.failures ? 'error' : 'idle', lastSync: Date.now(), pending: pendingCount(), message: pushed.failures ? `${pushed.failures} item(s) couldn't upload yet. Will retry.` : undefined });
    } catch (e) {
      setSync((x) => ({ ...x, state: navigator.onLine ? 'error' : 'offline', pending: pendingCount(), message: e instanceof Error ? e.message : 'Sync failed' }));
    } finally {
      syncing.current = false;
    }
  }, [repo, pendingCount]);

  // Sync on sign-in, on reconnect, when the app comes back, and every few minutes.
  useEffect(() => {
    if (!session) { setSync({ state: 'signed-out', lastSync: null, pending: 0 }); return; }
    syncNow();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC_EVERY_MS);
    const onOnline = () => syncNow();
    const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(t); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); };
  }, [session?.user.id, syncNow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Upload local changes shortly after they happen.
  const syncSoon = useRef<number>();
  const queueSync = useCallback(() => {
    window.clearTimeout(syncSoon.current);
    syncSoon.current = window.setTimeout(() => { if (live.current.session) syncNow(); }, 1500);
  }, [syncNow]);

  // ---- Derived snap views ----
  const snaps = useMemo<SnapView[]>(() => {
    const base = import.meta.env.BASE_URL;
    const example = settings.showExample ? [exampleSnap(here, base, firstRun)] : [];
    const myIds = new Set(mine.map((s) => s.id));
    const others = community.filter((c) => !myIds.has(c.id));
    return [...mine, ...others, ...example].map((s) => {
      const ix = interactions[s.id] ?? emptyIx(s.id);
      const sightingCount = totalSightings(s, ix);
      const sightings = [...ix.sightings, ...(s.crowd.lastSighting ? [s.crowd.lastSighting] : [])];
      const last = sightings.reduce<Sighting | null>((a, x) => (!a || x.at > a.at ? x : a), null);
      const position = last && last.at > s.createdAt ? { lat: last.lat, lng: last.lng } : s.location;
      return {
        ...s,
        likes: s.crowd.likes + (ix.liked ? 1 : 0),
        liked: ix.liked,
        comments: [...s.crowd.comments, ...ix.comments].sort((a, b) => a.at - b.at),
        sightingCount,
        mySightings: ix.sightings,
        lastSeen: Math.max(s.createdAt, last?.at ?? 0),
        position,
        rarity: rarityOf(s, sightingCount),
        score: overallScore(s.ratings),
        distanceKm: distanceKm(radarCenter, position),
        photoSrc: (s.photoId && photoUrls[s.photoId]) || (s.photoPath && cloudUrls[s.photoPath]) || s.photoUrl || null,
      };
    });
  }, [mine, community, interactions, settings.showExample, here, firstRun, radarCenter, photoUrls, cloudUrls, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const points = useMemo(() => pointsFor(mine, interactions, settings.username), [mine, interactions, settings.username]);

  // ---- Account actions ----
  // No username or other metadata is sent at sign-up: the server assigns a
  // neutral random username, which the user can change later in Settings.
  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await cloud().auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return data.session ? 'signed-in' : 'confirm-email';
  }, []);
  const changePassword = useCallback(async (password: string) => {
    const { error } = await cloud().auth.updateUser({ password });
    if (error) throw new Error(/reauth|recent/i.test(error.message) ? 'For security, sign out and back in, then change your password.' : error.message);
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await cloud().auth.signInWithPassword({ email, password });
    if (error) throw new Error(/confirm/i.test(error.message) ? 'Confirm your email first: tap the link we sent you, then sign in.' : 'Wrong email or password.');
  }, []);
  const signOut = useCallback(async () => {
    await cloud().auth.signOut({ scope: 'local' });
    setCommunity([]);
    setCloudUrls({});
    await repo.putMeta(COMMUNITY_CACHE, []);
  }, [repo]);
  const deleteAccount = useCallback(async () => {
    await cloudDeleteAccount();
    // Local copies stay on this phone, marked as not uploaded.
    const reset = live.current.mine.map((s) => ({ ...s, syncedAt: null, photoPath: s.photoId ? null : s.photoPath }));
    for (const s of reset) await repo.putSnap(s);
    await repo.putMeta(TOMBSTONES_KEY, []);
    setMine(reset);
    setCommunity([]);
    setCloudUrls({});
    await repo.putMeta(COMMUNITY_CACHE, []);
  }, [repo]);

  // ---- Local actions ----
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...live.current.settings, ...patch };
    setSettings(next);
    await repo.putSettings(next);
  }, [repo]);

  const setUsername = useCallback(async (name: string) => {
    const clean = name.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{2,24}$/.test(clean)) throw new Error('Usernames are 2–24 lowercase letters, numbers, dots, dashes or underscores.');
    if (live.current.session) await updateUsername(live.current.session.user.id, clean);
    await updateSettings({ username: clean });
  }, [updateSettings]);

  const savePhoto = useCallback(async (photo: Blob) => {
    const id = uid();
    const processed = await processPhoto(photo);
    await repo.putPhoto(id, processed);
    setPhotoUrls((u) => ({ ...u, [id]: URL.createObjectURL(processed) }));
    return id;
  }, [repo]);

  const addSnap = useCallback(async (draft: SnapDraft, photo: Blob | null, manualPoint?: GeoPoint | null) => {
    const best = bestFix(recentFixes.current);
    const fresh = best && Date.now() - best.at <= POST_FRESH_MS ? { lat: best.lat, lng: best.lng }
      : geo.point && geo.updatedAt && Date.now() - geo.updatedAt <= POST_FRESH_MS ? geo.point : null;
    const where = manualPoint ?? fresh;
    if (!where) throw new Error('No recent GPS fix yet. Tap "Type the place or pick it on a map", or wait for GPS. Your entry is kept.');
    const t = Date.now();
    const snap: Snap = {
      ...draft,
      id: uid(),
      source: 'mine',
      author: live.current.settings.username,
      createdAt: t,
      updatedAt: t,
      location: draft.blurred ? blurPoint(where) : where, // exact unless the poster chose to blur
      photoId: photo ? await savePhoto(photo) : null,
      photoPath: null,
      syncedAt: null,
      crowd: { likes: 0, sightings: 0, comments: [] },
    };
    await repo.putSnap(snap);
    setMine((m) => [snap, ...m]);
    queueSync();
    return snap.id;
  }, [geo.point, geo.updatedAt, savePhoto, repo, queueSync]);

  const addTombstone = useCallback(async (t: Tombstone) => {
    const list = (await repo.getMeta<Tombstone[]>(TOMBSTONES_KEY)) ?? [];
    await repo.putMeta(TOMBSTONES_KEY, [...list, t]);
  }, [repo]);

  const editSnap = useCallback(async (id: string, draft: SnapDraft, photo: Blob | null | undefined, moveTo?: GeoPoint | null) => {
    const old = live.current.mine.find((s) => s.id === id);
    if (!old) return;
    let photoId = old.photoId ?? null;
    let photoPath = old.photoPath ?? null;
    if (photo !== undefined) {
      if (photoId) await repo.deletePhoto(photoId);
      if (photoPath) await addTombstone({ kind: 'photo', path: photoPath });
      photoId = photo ? await savePhoto(photo) : null;
      photoPath = null;
    }
    const location = moveTo ? (old.blurred ? blurPoint(moveTo) : moveTo) : old.location;
    const next: Snap = { ...old, ...draft, blurred: old.blurred, location, photoId, photoPath, updatedAt: Date.now() };
    await repo.putSnap(next);
    setMine((m) => m.map((s) => (s.id === id ? next : s)));
    queueSync();
  }, [repo, savePhoto, addTombstone, queueSync]);

  const deleteSnap = useCallback(async (id: string) => {
    const old = live.current.mine.find((s) => s.id === id);
    await repo.deleteSnap(id);
    if (old?.photoId) await repo.deletePhoto(old.photoId);
    if (old && old.syncedAt != null) await addTombstone({ kind: 'snap', id, photoPath: old.photoPath ?? null });
    setMine((m) => m.filter((s) => s.id !== id));
    setInteractions((all) => { const n = { ...all }; delete n[id]; return n; });
    queueSync();
  }, [repo, addTombstone, queueSync]);

  const updateIx = useCallback(async (id: string, fn: (ix: Interaction) => Interaction) => {
    const next = fn(live.current.interactions[id] ?? emptyIx(id));
    setInteractions((all) => ({ ...all, [id]: next }));
    await repo.putInteraction(next);
    queueSync();
  }, [repo, queueSync]);

  const toggleLike = useCallback((id: string) => updateIx(id, (ix) => ({ ...ix, liked: !ix.liked })), [updateIx]);
  const addComment = useCallback((id: string, text: string) =>
    updateIx(id, (ix) => ({ ...ix, comments: [...ix.comments, { id: uid(), by: live.current.settings.username, text, at: Date.now(), synced: false }] })), [updateIx]);

  const logSighting = useCallback(async (id: string) => {
    if (!geo.point) { toast('Turn on location to log a sighting.'); return false; }
    const best = bestFix(recentFixes.current);
    const exact = best ? { lat: best.lat, lng: best.lng } : geo.point;
    const p = live.current.settings.blurLocations ? blurPoint(exact) : exact;
    await updateIx(id, (ix) => ({
      ...ix,
      sightings: [...ix.sightings, { ...p, id: uid(), at: Date.now(), by: live.current.settings.username, delayed: live.current.settings.delaySightings, synced: false }],
    }));
    return true;
  }, [geo.point, updateIx, toast]);

  const exportData = useCallback(async () => {
    const blob = await exportBackup(repo);
    return saveFile(blob, `catsnap-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }, [repo]);

  const importData = useCallback(async (file: File) => {
    const { snaps: n } = await importBackup(repo, await file.text());
    await reload();
    queueSync();
    toast(`Restored ${n} snap${n === 1 ? '' : 's'} from backup`);
  }, [repo, reload, toast, queueSync]);

  const resetAll = useCallback(async () => {
    await repo.clearAll();
    await reload();
  }, [repo, reload]);

  useEffect(() => { setSync((x) => ({ ...x, pending: pendingCount() })); }, [mine, interactions, pendingCount]);

  const value: Ctx = {
    ready, settings, geo, here, radarCenter, travel, setTravel, snaps, points, persisted, toast, toastMsg,
    account, sync, syncNow, getBestFix: () => bestFix(recentFixes.current), signUp, changePassword, signIn, signOut, deleteAccount,
    updateSettings, setUsername, addSnap, editSnap, deleteSnap, toggleLike, addComment, logSighting, exportData, importData, resetAll,
    requestLocation: startWatch,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
