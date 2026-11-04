import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { CITIES } from '../../core/example';
import { formatDistance, offsetKm, timeAgo } from '../../core/geo';
import { TIERS } from '../../core/rules';
import { useStore, type SnapView } from '../store';
import { AdCard } from '../components/AdCard';
import { CatArt } from '../components/CatArt';
import { RarityBadge } from '../components/bits';
import { Icon } from '../components/Icon';
import { catSVG } from '../../core/catArt';
import { HABITATS } from '../../core/catalog';
import { locationMessage } from '../../data/location';

export interface RadarFilters { radiusKm: number; ageH: number; minTier: number; focusId: string | null }
interface Props { filters: RadarFilters; setFilters: (f: RadarFilters) => void; onOpen: (id: string) => void; onPlus: (feature?: string) => void }

const zoomFor = (r: number) => (r <= 1 ? 15 : r <= 3 ? 14 : r <= 10 ? 12 : 11);

function pinHtml(s: SnapView) {
  const fresh = Date.now() - s.lastSeen < 3600000;
  const art = s.photoSrc ? `<img src="${s.photoSrc}" alt="" />` : catSVG({ coat: s.coat, eyes: s.eyes, bg: HABITATS[s.habitat].bg });
  return `<div class="cat-pin r${s.rarity.tier} ${fresh ? 'fresh' : ''}">${art}</div>`;
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], zoom); }, [map, lat, lng, zoom]);
  return null;
}

export function Radar({ filters, setFilters, onOpen, onPlus }: Props) {
  const { snaps, radarCenter, geo, settings, updateSettings, travel, setTravel, requestLocation, toast } = useStore();
  const tier = settings.plus ? TIERS.plus : TIERS.free;
  const all = TIERS.plus;

  const list = useMemo(() => snaps
    .filter((s) => s.source !== 'example')
    .filter((s) => s.distanceKm <= filters.radiusKm && Date.now() - s.lastSeen <= filters.ageH * 3600000 && s.rarity.tier >= filters.minTier)
    .sort((a, b) => a.distanceKm - b.distanceKm), [snaps, filters]);

  const focus = filters.focusId ? snaps.find((s) => s.id === filters.focusId) : null;
  const center = focus && settings.radarView === 'map' ? focus.position : radarCenter;
  const zoom = focus ? 16 : zoomFor(filters.radiusKm);

  const status = travel ? `Travel mode · ${travel.label}`
    : geo.status === 'live' ? `GPS live · ±${Math.round(geo.accuracy ?? 0)} m`
    : geo.status === 'pending' ? 'Finding you…'
    : geo.status === 'searching' ? 'Searching for GPS…'
    : geo.status === 'off' ? 'Location off · demo city'
    : geo.status === 'denied' ? 'Location blocked · demo city' : 'No location · demo city';

  const locked = (ok: boolean) => !settings.plus && !ok;
  const seg = <T extends number>(values: readonly T[], current: T, allowed: readonly number[], label: (v: T) => string, set: (v: T) => void, feature: string) =>
    values.map((v) => {
      const isLocked = locked(allowed.includes(v));
      return (
        <button key={v} className={`${current === v ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
          onClick={() => (isLocked ? onPlus(feature) : set(v))}>
          {isLocked && <Icon name="lock" />}{label(v)}
        </button>
      );
    });

  return (
    <section className="view" aria-label="Cat radar">
      <div className="radar-head">
        <div>
          <p className="eyebrow">Cat Radar</p>
          <h1>{travel ? `Previewing ${travel.label}` : 'Recent sightings near you'}</h1>
        </div>
        <button className="icon-btn" title="Centre on me" aria-label="Centre on me" onClick={() => {
          setTravel(null); setFilters({ ...filters, focusId: null }); requestLocation();
          if (geo.status !== 'live') toast(locationMessage(geo.status, geo.accuracy, !!geo.point));
        }}><Icon name="locate" /></button>
      </div>

      {!travel && geo.status !== 'live' && geo.status !== 'pending' && (
        <div className="loc-help">
          <Icon name="locate" />
          <span>{locationMessage(geo.status, geo.accuracy, !!geo.point)} Until then the radar shows the demo city.</span>
          <button className="pill-btn" onClick={requestLocation}>Retry</button>
        </div>
      )}
      <div className="view-toggle seg">
        <button className={settings.radarView === 'map' ? 'active' : ''} onClick={() => updateSettings({ radarView: 'map' })}><Icon name="map" />Map</button>
        <button className={settings.radarView === 'scope' ? 'active' : ''} onClick={() => updateSettings({ radarView: 'scope' })}><Icon name="radar" />Radar</button>
      </div>

      <div className="radar-wrap">
        {settings.radarView === 'map' ? (
          <MapContainer center={[center.lat, center.lng]} zoom={zoom} zoomControl={false} attributionControl className="leaflet-map">
            <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            <Recenter lat={center.lat} lng={center.lng} zoom={zoom} />
            <Circle center={[radarCenter.lat, radarCenter.lng]} radius={filters.radiusKm * 1000}
              pathOptions={{ color: '#e5862a', weight: 1.5, fillOpacity: 0.04, dashArray: '6 6' }} />
            {geo.point && !travel && (
              <Marker position={[geo.point.lat, geo.point.lng]} interactive={false}
                icon={L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [18, 18] })} />
            )}
            {list.map((s) => (
              <Marker key={s.id} position={[s.position.lat, s.position.lng]}
                icon={L.divIcon({ className: '', html: pinHtml(s), iconSize: [46, 46], iconAnchor: [23, 23] })}
                eventHandlers={{ click: () => onOpen(s.id) }} />
            ))}
          </MapContainer>
        ) : (
          <Scope list={list} radiusKm={filters.radiusKm} focusId={filters.focusId} onOpen={onOpen} />
        )}
        {settings.radarView === 'scope' && <div className="radar-sweep" aria-hidden="true" />}
        <div className="radar-status mono">{status}</div>
      </div>

      <div className="radar-controls">
        <div className="control">
          <span className="control-label">Range</span>
          <div className="seg">{seg(all.radiusKm, filters.radiusKm, tier.radiusKm, (v) => `${v} km`, (v) => setFilters({ ...filters, radiusKm: v, focusId: null }), 'A wider radar')}</div>
        </div>
        <div className="control">
          <span className="control-label">Seen in</span>
          <div className="seg">{seg(all.ageH, filters.ageH, tier.ageH, (v) => (v < 48 ? `${v} h` : `${v / 24} d`), (v) => setFilters({ ...filters, ageH: v }), 'Longer radar history')}</div>
        </div>
        <div className="control">
          <span className="control-label">Rarity</span>
          <div className="seg">{seg([0, 2, 3] as const, filters.minTier as 0 | 2 | 3, tier.rarityFilter ? [0, 2, 3] : [0], (v) => (v === 0 ? 'All' : v === 2 ? 'Rare+' : 'Legendary'), (v) => setFilters({ ...filters, minTier: v }), 'Rarity filtering')}</div>
        </div>
        <div className="control">
          <span className="control-label">Travel</span>
          <div className="seg scroll">
            <button className={!travel ? 'active' : ''} onClick={() => setTravel(null)}>Here</button>
            {CITIES.map((c) => (
              <button key={c.key} className={`${travel?.key === c.key ? 'active' : ''} ${locked(tier.travel) ? 'locked' : ''}`}
                onClick={() => (locked(tier.travel) ? onPlus('Travel mode') : setTravel(c.key))}>
                {locked(tier.travel) && <Icon name="lock" />}{c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="list-head">
        <h2>Nearby sightings</h2>
        <span className="muted small mono">{list.length} within {filters.radiusKm} km</span>
      </div>
      <ul className="radar-list">
        {list.length === 0 && <li className="empty">No cats seen in range lately. {settings.plus ? 'Try a wider range or longer window.' : 'Plus widens the radar to 25 km and 30 days.'}</li>}
        {list.map((s) => (
          <li key={s.id} onClick={() => onOpen(s.id)} className={filters.focusId === s.id ? 'focus' : ''}>
            <div className={`mini-art r${s.rarity.tier}`}><CatArt photoSrc={s.photoSrc} name={s.name} coat={s.coat} eyes={s.eyes} habitat={s.habitat} /></div>
            <div className="grow">
              <div className="li-name">{s.name} <RarityBadge r={s.rarity} inline /></div>
              <div className="li-sub">{s.spot}</div>
            </div>
            <div className="right"><strong>{formatDistance(s.distanceKm)}</strong><span className="mono muted">{timeAgo(s.lastSeen)}</span></div>
          </li>
        ))}
      </ul>
      {!settings.plus && <AdCard n={1} onRemoveAds={() => onPlus('Ad-free browsing')} onTap={() => toast('Mock ad. In the real app this opens the advertiser.')} />}
      <p className="privacy-note"><Icon name="lock" /> Every pin is blurred by about 100 m, Free or Plus, and exact GPS is never saved, so no cat can be tracked to an exact spot.</p>
    </section>
  );
}

function Scope({ list, radiusKm, focusId, onOpen }: { list: SnapView[]; radiusKm: number; focusId: string | null; onOpen: (id: string) => void }) {
  const { radarCenter } = useStore();
  return (
    <div className="scope-mode">
      <div className="scope">
        {[0.25, 0.5, 0.75, 1].map((f) => <div key={f} className="ring" style={{ width: `${f * 90}%` }}><span>{formatDistance(radiusKm * f)}</span></div>)}
        <div className="axis h" /><div className="axis v" />
        {([['N', 50, 2.5], ['E', 97.5, 50], ['S', 50, 97.5], ['W', 2.5, 50]] as const).map(([t, x, y]) =>
          <span key={t} className="tick" style={{ left: `${x}%`, top: `${y}%` }}>{t}</span>)}
        <div className="me-pin scope-me" />
        {list.map((s) => {
          const o = offsetKm(radarCenter, s.position);
          const fresh = Date.now() - s.lastSeen < 3600000;
          return (
            <button key={s.id} className={`cat-pin scope-pin r${s.rarity.tier} ${fresh ? 'fresh' : ''} ${focusId === s.id ? 'focus' : ''}`}
              style={{ left: `${50 + (o.x / radiusKm) * 45}%`, top: `${50 - (o.y / radiusKm) * 45}%` }}
              onClick={() => onOpen(s.id)} aria-label={`${s.name}, ${formatDistance(s.distanceKm)} away`}>
              <CatArt photoSrc={s.photoSrc} name={s.name} coat={s.coat} eyes={s.eyes} habitat={s.habitat} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
