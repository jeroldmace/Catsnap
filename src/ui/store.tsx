import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CITIES, DEMO_CENTER, demoSnaps } from '../core/demo';
import { blurPoint, distanceKm } from '../core/geo';
import { overallScore, pointsFor, rarityOf, totalSightings, type Rarity } from '../core/rules';
import { DEFAULT_SETTINGS, type Comment, type GeoPoint, type Interaction, type Settings, type Sighting, type Snap } from '../core/types';
import { exportBackup, importBackup, downloadBlob } from '../data/backup';
import { createIdbRepository, requestPersistentStorage } from '../data/idbRepository';
import type { Repository } from '../data/repository';
import { processPhoto } from '../data/photos';

export type GeoStatus = 'pending' | 'live' | 'denied' | 'unavailable';
export interface GeoState { status: GeoStatus; point: GeoPoint | null; accuracy: number | null; updatedAt: number | null }

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

export type SnapDraft = Omit<Snap, 'id' | 'source' | 'author' | 'createdAt' | 'updatedAt' | 'location' | 'photoId' | 'photoUrl' | 'crowd'>;

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
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  addSnap: (draft: SnapDraft, photo: Blob | null) => Promise<string>;
  editSnap: (id: string, draft: SnapDraft, photo: Blob | null | undefined) => Promise<void>;
  deleteSnap: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  logSighting: (id: string) => Promise<boolean>;
  exportData: () => Promise<void>;
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

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const emptyIx = (snapId: string): Interaction => ({ snapId, liked: false, comments: [], sightings: [] });

export function StoreProvider({ children, repo: injected }: { children: ReactNode; repo?: Repository }) {
  const repo = useMemo(() => injected ?? createIdbRepository(), [injected]);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mine, setMine] = useState<Snap[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [geo, setGeo] = useState<GeoState>({ status: 'pending', point: null, accuracy: null, updatedAt: null });
  const [demoAnchor, setDemoAnchor] = useState<GeoPoint | null>(null);
  const [travel, setTravelState] = useState<(typeof CITIES)[number] | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toastTimer = useRef<number>();

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // Refresh relative times every minute.
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(t); }, []);

  // ---- Load from storage ----
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
    await loadPhotos(data.snaps);
  }, [repo, loadPhotos]);

  useEffect(() => {
    reload().catch(() => toast("Couldn't open on-device storage. Snaps won't be saved.")).finally(() => setReady(true));
    requestPersistentStorage().then(setPersisted);
  }, [reload, toast]);

  // ---- Location ----
  const watchId = useRef<number | null>(null);
  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeo((g) => ({ ...g, status: 'unavailable' })); return; }
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeo({ status: 'live', point, accuracy: pos.coords.accuracy, updatedAt: pos.timestamp });
        setDemoAnchor((a) => a ?? point);
      },
      (err) => setGeo((g) => ({ ...g, status: err.code === err.PERMISSION_DENIED ? 'denied' : g.point ? 'live' : 'unavailable' })),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }, []);
  useEffect(() => {
    startWatch();
    return () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); };
  }, [startWatch]);

  const here = useMemo(() => geo.point ?? { ...DEMO_CENTER }, [geo.point]);
  const radarCenter = useMemo(() => (travel ? { lat: travel.lat, lng: travel.lng, label: travel.label } : here), [travel, here]);
  const setTravel = useCallback((key: string | null) => setTravelState(key ? CITIES.find((c) => c.key === key) ?? null : null), []);

  // ---- Derived snap views ----
  const snaps = useMemo<SnapView[]>(() => {
    const anchor = travel ?? demoAnchor ?? DEMO_CENTER;
    const base = import.meta.env.BASE_URL;
    const demo = settings.showDemo ? demoSnaps(anchor, settings.username, base, now) : [];
    return [...mine, ...demo].map((s) => {
      const ix = interactions[s.id] ?? emptyIx(s.id);
      const sightingCount = totalSightings(s, ix);
      const last = ix.sightings.reduce<Sighting | null>((a, x) => (!a || x.at > a.at ? x : a), null);
      const position = last && last.at > s.createdAt ? { lat: last.lat, lng: last.lng } : s.location;
      return {
        ...s,
        likes: s.crowd.likes + (ix.liked ? 1 : 0),
        liked: ix.liked,
        comments: [...s.crowd.comments, ...ix.comments],
        sightingCount,
        mySightings: ix.sightings,
        lastSeen: Math.max(s.createdAt, last?.at ?? 0),
        position,
        rarity: rarityOf(s, sightingCount),
        score: overallScore(s.ratings),
        distanceKm: distanceKm(radarCenter, position),
        photoSrc: s.photoId ? photoUrls[s.photoId] ?? null : s.photoUrl ?? null,
      };
    });
  }, [mine, interactions, settings.showDemo, settings.username, demoAnchor, travel, radarCenter, photoUrls, now]);

  const points = useMemo(() => pointsFor(mine, interactions, settings.username), [mine, interactions, settings.username]);

  // ---- Actions ----
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await repo.putSettings(next);
  }, [settings, repo]);

  const savePhoto = useCallback(async (photo: Blob) => {
    const id = uid();
    const processed = await processPhoto(photo);
    await repo.putPhoto(id, processed);
    setPhotoUrls((u) => ({ ...u, [id]: URL.createObjectURL(processed) }));
    return id;
  }, [repo]);

  const addSnap = useCallback(async (draft: SnapDraft, photo: Blob | null) => {
    const t = Date.now();
    const exact = geo.point ?? DEMO_CENTER;
    const snap: Snap = {
      ...draft,
      id: uid(),
      source: 'mine',
      author: settings.username,
      createdAt: t,
      updatedAt: t,
      location: blurPoint(exact), // the exact point is never stored
      photoId: photo ? await savePhoto(photo) : null,
      crowd: { likes: 0, sightings: 0, comments: [] },
    };
    await repo.putSnap(snap);
    setMine((m) => [snap, ...m]);
    return snap.id;
  }, [geo.point, settings.username, savePhoto, repo]);

  const editSnap = useCallback(async (id: string, draft: SnapDraft, photo: Blob | null | undefined) => {
    const old = mine.find((s) => s.id === id);
    if (!old) return;
    let photoId = old.photoId ?? null;
    if (photo !== undefined) {
      if (photoId) await repo.deletePhoto(photoId);
      photoId = photo ? await savePhoto(photo) : null;
    }
    const next: Snap = { ...old, ...draft, photoId, updatedAt: Date.now() };
    await repo.putSnap(next);
    setMine((m) => m.map((s) => (s.id === id ? next : s)));
  }, [mine, repo, savePhoto]);

  const deleteSnap = useCallback(async (id: string) => {
    const old = mine.find((s) => s.id === id);
    await repo.deleteSnap(id);
    if (old?.photoId) await repo.deletePhoto(old.photoId);
    setMine((m) => m.filter((s) => s.id !== id));
    setInteractions((all) => { const n = { ...all }; delete n[id]; return n; });
  }, [mine, repo]);

  const updateIx = useCallback(async (id: string, fn: (ix: Interaction) => Interaction) => {
    const next = fn(interactions[id] ?? emptyIx(id));
    setInteractions((all) => ({ ...all, [id]: next }));
    await repo.putInteraction(next);
  }, [interactions, repo]);

  const toggleLike = useCallback((id: string) => updateIx(id, (ix) => ({ ...ix, liked: !ix.liked })), [updateIx]);
  const addComment = useCallback((id: string, text: string) =>
    updateIx(id, (ix) => ({ ...ix, comments: [...ix.comments, { id: uid(), by: settings.username, text, at: Date.now() }] })), [updateIx, settings.username]);

  const logSighting = useCallback(async (id: string) => {
    if (!geo.point) { toast('Turn on location to log a sighting.'); return false; }
    const p = blurPoint(geo.point);
    await updateIx(id, (ix) => ({ ...ix, sightings: [...ix.sightings, { ...p, at: Date.now(), by: settings.username }] }));
    return true;
  }, [geo.point, updateIx, settings.username, toast]);

  const exportData = useCallback(async () => {
    const blob = await exportBackup(repo);
    downloadBlob(blob, `catsnap-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }, [repo]);

  const importData = useCallback(async (file: File) => {
    const { snaps: n } = await importBackup(repo, await file.text());
    await reload();
    toast(`Restored ${n} snap${n === 1 ? '' : 's'} from backup`);
  }, [repo, reload, toast]);

  const resetAll = useCallback(async () => {
    await repo.clearAll();
    await reload();
  }, [repo, reload]);

  const value: Ctx = {
    ready, settings, geo, here, radarCenter, travel, setTravel, snaps, points, persisted, toast, toastMsg,
    updateSettings, addSnap, editSnap, deleteSnap, toggleLike, addComment, logSighting, exportData, importData, resetAll,
    requestLocation: startWatch,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
