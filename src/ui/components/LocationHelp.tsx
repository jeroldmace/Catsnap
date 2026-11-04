import { isNative } from '../../data/platform';
import { useEffect, useState } from 'react';
import { STALE_MS, locationMessage, openAppSettings, openLocationSettings, satelliteStatus } from '../../data/location';
import { useStore } from '../store';
import { Icon } from './Icon';

/** Explains the current location problem and offers the right fix. */
export function LocationHelp({ suffix, compact }: { suffix?: string; compact?: boolean }) {
  const { geo, requestLocation } = useStore();
  const native = isNative();
  const fresh = geo.status === 'live' && !!geo.updatedAt && Date.now() - geo.updatedAt < STALE_MS;
  const [sats, setSats] = useState<{ inView: number; used: number } | null>(null);
  // While GPS is acquiring, show satellite progress so "searching" isn't a black box.
  useEffect(() => {
    if (!native || fresh || geo.status === 'off' || geo.status === 'denied') { setSats(null); return; }
    let alive = true;
    const tick = () => satelliteStatus().then((s) => alive && setSats(s));
    tick();
    const t = window.setInterval(tick, 4000);
    return () => { alive = false; window.clearInterval(t); };
  }, [native, fresh, geo.status]);
  return (
    <div className={`loc-help ${compact ? 'compact' : ''}`}>
      <Icon name="locate" />
      <span>{locationMessage(geo.status, geo.accuracy, !!geo.point, geo.updatedAt)}{suffix ? ` ${suffix}` : ''}
        {sats && <strong className="sats"> Satellites: {sats.inView} seen, {sats.used} locked{sats.inView > 0 && sats.used < 4 ? ' (a fix needs about 4; stay under open sky)' : ''}.</strong>}
      </span>
      <div className="loc-help-actions">
        {native && geo.status === 'off' && <button className="pill-btn dark" onClick={() => openLocationSettings()}>Location settings</button>}
        {native && geo.status === 'denied' && <button className="pill-btn dark" onClick={() => openAppSettings()}>App permissions</button>}
        {!fresh && <button className="pill-btn" onClick={requestLocation}>Retry</button>}
      </div>
    </div>
  );
}
