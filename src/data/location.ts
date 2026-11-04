import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export type LocStatus = 'pending' | 'live' | 'searching' | 'off' | 'denied' | 'unsupported';
export interface Fix { lat: number; lng: number; accuracy: number; at: number; source: string }
type OnFix = (f: Fix) => void;
type OnStatus = (s: LocStatus, detail?: string) => void;

/** Fixes older than this are shown as "last known position", not live GPS. */
export const STALE_MS = 2 * 60 * 1000;

// Native module (android/.../CatLocationPlugin.java): Android's own GPS + network
// location, independent of Google Play services.
interface CatStatus { permission: string; enabled: boolean; gps: boolean; network: boolean }
interface CatFix { lat?: number; lng?: number; accuracy?: number; time?: number; provider?: string; cached?: boolean; off?: boolean; searching?: boolean }
interface CatLocationPlugin {
  status(): Promise<CatStatus>;
  request(): Promise<CatStatus>;
  watch(options: Record<string, never>, cb: (data: CatFix | null, err?: unknown) => void): Promise<string>;
  clearWatch(o: { id: string }): Promise<void>;
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
}
const CatLocation = registerPlugin<CatLocationPlugin>('CatLocation');

export const openLocationSettings = () => (isNative() ? CatLocation.openLocationSettings().catch(() => {}) : Promise.resolve());
export const openAppSettings = () => (isNative() ? CatLocation.openAppSettings().catch(() => {}) : Promise.resolve());

/**
 * Start following the device location; returns a stop function.
 * Native app: Android LocationManager (GPS + network) and, as a bonus, Google's
 * fused location; whichever answers first wins. Web: the Geolocation API.
 * Never gives up: keeps listening until a fix arrives.
 */
// Counters for the diagnostics readout in Settings.
const diag = { started: 0, fixes: {} as Record<string, number>, lastError: '', lastErrorAt: 0, lastStatus: '' };

export function startLocation(onFix: OnFix, onStatus: OnStatus): () => void {
  diag.started = Date.now();
  let stopped = false;
  const stops: (() => void)[] = [];
  let lastFixAt = 0;
  const fix: OnFix = (f) => { if (stopped) return; lastFixAt = Date.now(); diag.fixes[f.source] = (diag.fixes[f.source] ?? 0) + 1; onFix(f); };
  const status: OnStatus = (s, d) => {
    if (stopped) return;
    diag.lastStatus = s;
    if (d) { diag.lastError = d.slice(0, 200); diag.lastErrorAt = Date.now(); }
    onStatus(s, d);
  };

  // If nothing arrives for a while, say we're still searching (never "unavailable").
  const searchTimer = window.setInterval(() => { if (!lastFixAt) status('searching'); }, 15000);
  stops.push(() => window.clearInterval(searchTimer));

  if (isNative()) {
    startNative(fix, status).then((s) => { if (stopped) s(); else stops.push(s); })
      .catch((e) => { status('searching', String((e as Error)?.message ?? e)); stops.push(startWeb(fix, status)); });
  } else {
    stops.push(startWeb(fix, status));
  }
  return () => { stopped = true; stops.forEach((s) => s()); };
}

export function classify(err: unknown): LocStatus | 'fallback' {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/play services|google play|not implemented|unimplemented/i.test(msg)) return 'fallback';
  if (/not enabled|disabled|turned off|location services|settings/i.test(msg)) return 'off';
  if (/denied|permission/i.test(msg)) return 'denied';
  return 'searching';
}

async function startNative(onFix: OnFix, onStatus: OnStatus): Promise<() => void> {
  let st = await CatLocation.status();
  if (st.permission !== 'granted') st = await CatLocation.request();
  if (st.permission !== 'granted') { onStatus('denied'); return () => {}; }
  if (!st.enabled) onStatus('off');

  const id = await CatLocation.watch({}, (data, err) => {
    if (err) { const c = classify(err); onStatus(c === 'fallback' ? 'searching' : c, String(err)); return; }
    if (!data) return;
    if (data.off) { onStatus('off'); return; }
    if (data.searching) { onStatus('searching'); return; }
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      onFix({ lat: data.lat, lng: data.lng, accuracy: data.accuracy ?? 9999, at: data.time ?? Date.now(), source: data.provider ?? 'gps' });
    }
  });
  const stopFused = await startFused(onFix).catch((e) => { diag.lastError = `fused: ${String((e as Error)?.message ?? e).slice(0, 160)}`; diag.lastErrorAt = Date.now(); return () => {}; });
  return () => { CatLocation.clearWatch({ id }).catch(() => {}); stopFused(); };
}

/** Google fused location: often fastest where Google services work. Errors are ignored. */
async function startFused(onFix: OnFix): Promise<() => void> {
  const { Geolocation } = await import('@capacitor/geolocation');
  const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 60000, maximumAge: 10000 }, (pos) => {
    if (pos) onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp, source: 'fused' });
  });
  return () => { Geolocation.clearWatch({ id }).catch(() => {}); };
}

function startWeb(onFix: OnFix, onStatus: OnStatus): () => void {
  if (!('geolocation' in navigator)) { onStatus('unsupported'); return () => {}; }
  const ok = (p: GeolocationPosition) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp, source: 'browser' });
  const bad = (e: GeolocationPositionError) => onStatus(e.code === e.PERMISSION_DENIED ? 'denied' : 'searching', e.message);
  navigator.geolocation.getCurrentPosition(ok, bad, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  const id = navigator.geolocation.watchPosition(ok, bad, { enableHighAccuracy: true, timeout: 60000, maximumAge: 10000 });
  return () => navigator.geolocation.clearWatch(id);
}

/** One plain-language line for the current location state. */
export function locationMessage(status: LocStatus, accuracy: number | null, hasPoint: boolean, fixAt?: number | null): string {
  const age = fixAt ? Date.now() - fixAt : 0;
  switch (status) {
    case 'live':
      if (age > STALE_MS) return `Using your last known position from ${Math.round(age / 60000)} min ago while GPS looks for a fresh fix.`;
      return `GPS live, accurate to about ${Math.round(accuracy ?? 0)} m.`;
    case 'pending': return 'Finding your location…';
    case 'searching': return hasPoint ? 'Using your last known position while GPS refreshes.' : 'Still looking for a GPS fix. Step outside or near a window; a first fix can take a few minutes. You can also set the spot on a map when you post.';
    case 'off': return isNative() ? "Your phone's Location is turned off. Tap \"Location settings\" and turn it on." : "Your device's location is turned off.";
    case 'denied': return isNative()
      ? 'Cat Snap isn\'t allowed to use your location. Tap "App permissions" → Location → "Allow while using the app".'
      : "Location is blocked for this site. Allow it in your browser's site settings, then tap Retry.";
    case 'unsupported': return "This device can't share its location. You can set the spot on a map when you post.";
  }
}

/** A short technical summary to screenshot when location misbehaves. */
export async function locationDiagnostics(): Promise<string> {
  const lines: string[] = [];
  lines.push(`platform: ${isNative() ? 'android app' : 'web'}; online: ${navigator.onLine}`);
  if (isNative()) {
    try {
      const st = await CatLocation.status();
      lines.push(`permission: ${st.permission}; location on: ${st.enabled}; gps provider: ${st.gps}; network provider: ${st.network}`);
    } catch (e) { lines.push(`status error: ${String((e as Error)?.message ?? e).slice(0, 120)}`); }
  }
  const secs = diag.started ? Math.round((Date.now() - diag.started) / 1000) : 0;
  const fixes = Object.entries(diag.fixes).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  lines.push(`listening for ${secs}s; fixes: ${fixes}; last status: ${diag.lastStatus || '-'}`);
  if (diag.lastError) lines.push(`last error (${Math.round((Date.now() - diag.lastErrorAt) / 1000)}s ago): ${diag.lastError}`);
  return lines.join('\n');
}
