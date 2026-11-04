import { isNative } from './platform';

export type LocStatus = 'pending' | 'live' | 'searching' | 'off' | 'denied' | 'unsupported';
export interface Fix { lat: number; lng: number; accuracy: number; at: number }
type OnFix = (f: Fix) => void;
type OnStatus = (s: LocStatus) => void;

/**
 * Start following the device location. Uses Android's fused location service
 * in the native app (more reliable than the WebView's own lookup) and the
 * browser Geolocation API on the web. Returns a stop function.
 */
export function startLocation(onFix: OnFix, onStatus: OnStatus): () => void {
  let stopped = false;
  let stopInner: (() => void) | null = null;
  const fix: OnFix = (f) => { if (!stopped) onFix(f); };
  const status: OnStatus = (s) => { if (!stopped) onStatus(s); };

  const run = isNative() ? startNative(fix, status, () => { stopInner = startWeb(fix, status); }) : Promise.resolve(startWeb(fix, status));
  run.then((stop) => { if (stopped) stop?.(); else if (stop) stopInner = stop; }).catch(() => { if (!stopped) stopInner = startWeb(fix, status); });

  return () => { stopped = true; stopInner?.(); };
}

export function classify(err: unknown): LocStatus | 'fallback' {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/play services|google play|not implemented|unimplemented/i.test(msg)) return 'fallback';
  if (/not enabled|disabled|turned off|location services|settings/i.test(msg)) return 'off';
  if (/denied|permission/i.test(msg)) return 'denied';
  return 'searching';
}

async function startNative(onFix: OnFix, onStatus: OnStatus, fallback: () => void): Promise<(() => void) | null> {
  const { Geolocation } = await import('@capacitor/geolocation');
  let perm = await Geolocation.checkPermissions();
  if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
    try { perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] }); }
    catch (e) { const c = classify(e); if (c === 'fallback') { fallback(); return null; } onStatus(c); return null; }
  }
  if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') { onStatus('denied'); return null; }

  const toFix = (p: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }) =>
    onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp });
  let usedFallback = false;
  const onErr = (e: unknown) => {
    const c = classify(e);
    if (c === 'fallback') { if (!usedFallback) { usedFallback = true; fallback(); } return; }
    onStatus(c);
  };

  // A quick rough fix first (Wi-Fi / cell), then keep refining with GPS.
  Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }).then(toFix).catch(onErr);
  const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }, (pos, err) => {
    if (err) onErr(err); else if (pos) toFix(pos);
  });
  return () => { Geolocation.clearWatch({ id }).catch(() => {}); };
}

function startWeb(onFix: OnFix, onStatus: OnStatus): () => void {
  if (!('geolocation' in navigator)) { onStatus('unsupported'); return () => {}; }
  const ok = (p: GeolocationPosition) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp });
  const bad = (e: GeolocationPositionError) => onStatus(e.code === e.PERMISSION_DENIED ? 'denied' : 'searching');
  navigator.geolocation.getCurrentPosition(ok, bad, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  const id = navigator.geolocation.watchPosition(ok, bad, { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
  return () => navigator.geolocation.clearWatch(id);
}

/** One plain-language line for the current location state. */
export function locationMessage(status: LocStatus, accuracy: number | null, hasPoint: boolean): string {
  switch (status) {
    case 'live': return `GPS live, accurate to about ${Math.round(accuracy ?? 0)} m.`;
    case 'pending': return 'Finding your location…';
    case 'searching': return hasPoint ? 'Using your last known position while GPS refreshes.' : 'Still looking for GPS. Step outside or near a window; it can take up to a minute.';
    case 'off': return "Your phone's Location is turned off. Swipe down from the top of the screen, turn on Location, then tap Retry.";
    case 'denied': return isNative()
      ? "Cat Snap isn't allowed to use your location. Open phone Settings → Apps → Cat Snap → Permissions → Location, choose \"Allow while using the app\", then tap Retry."
      : "Location is blocked for this site. Allow it in your browser's site settings, then tap Retry.";
    case 'unsupported': return "This device can't share its location.";
  }
}
