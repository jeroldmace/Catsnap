import { isNative } from '../../data/platform';
import { STALE_MS, locationMessage, openAppSettings, openLocationSettings } from '../../data/location';
import { useStore } from '../store';
import { Icon } from './Icon';

/** Explains the current location problem and offers the right fix. */
export function LocationHelp({ suffix, compact }: { suffix?: string; compact?: boolean }) {
  const { geo, requestLocation } = useStore();
  const native = isNative();
  return (
    <div className={`loc-help ${compact ? 'compact' : ''}`}>
      <Icon name="locate" />
      <span>{locationMessage(geo.status, geo.accuracy, !!geo.point, geo.updatedAt)}{suffix ? ` ${suffix}` : ''}</span>
      <div className="loc-help-actions">
        {native && geo.status === 'off' && <button className="pill-btn dark" onClick={() => openLocationSettings()}>Location settings</button>}
        {native && geo.status === 'denied' && <button className="pill-btn dark" onClick={() => openAppSettings()}>App permissions</button>}
        {!(geo.status === 'live' && geo.updatedAt && Date.now() - geo.updatedAt < STALE_MS) && <button className="pill-btn" onClick={requestLocation}>Retry</button>}
      </div>
    </div>
  );
}
