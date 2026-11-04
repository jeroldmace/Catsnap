import { useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { GeoPoint } from '../../core/types';
import { parseCoordinates, searchPlaces, type Place } from '../../data/geocode';
import { Icon } from './Icon';

const pin = L.divIcon({ className: '', html: '<div class="pick-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 13] });

function ClickToSet({ onPick }: { onPick: (p: GeoPoint) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * Choose where a cat was seen when GPS can't get a fix: tap the map, or type
 * a place, address or coordinates.
 */
export function MapPicker({ start, initial, onDone, onCancel }: { start: GeoPoint; initial: GeoPoint | null; onDone: (p: GeoPoint) => void; onCancel: () => void }) {
  const [p, setP] = useState<GeoPoint | null>(initial);
  const [map, setMap] = useState<L.Map | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const choose = (place: GeoPoint, zoom = 17) => {
    setP(place);
    setResults(null);
    map?.setView([place.lat, place.lng], zoom);
  };

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMsg(null);
    const coords = parseCoordinates(q);
    if (coords) { choose(coords); return; }
    if (!q.trim()) return;
    if (!navigator.onLine) { setMsg('No connection. Type coordinates (e.g. 29.5603, 106.5776) or tap the map.'); return; }
    setBusy(true);
    try {
      const found = await searchPlaces(q, p ?? start);
      if (!found.length) setMsg('No matches. Try a nearby landmark or street, or type coordinates.');
      else if (found.length === 1) choose(found[0]);
      else setResults(found);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Search failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="map-picker" role="dialog" aria-modal="true" aria-label="Choose the spot">
      <div className="map-picker-head">
        <div><strong>Where was the cat?</strong><span className="muted small">Search, type coordinates, or tap the map. It's still blurred about 100 m when saved.</span></div>
        <button className="sheet-close static" aria-label="Cancel" onClick={onCancel}><Icon name="x" /></button>
      </div>
      <form className="place-search" onSubmit={search}>
        <input id="placeSearch" type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Place, address or 29.5603, 106.5776" autoComplete="off" />
        <button type="submit" className="pill-btn dark" disabled={busy || !q.trim()}>{busy ? '…' : 'Search'}</button>
      </form>
      {msg && <p className="place-msg">{msg}</p>}
      <div className="map-picker-map">
        {results && (
          <ul className="place-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}><button onClick={() => choose(r)}><Icon name="pin" /><span>{r.label}</span></button></li>
            ))}
            <li><button className="muted" onClick={() => setResults(null)}>Close results</button></li>
          </ul>
        )}
        <MapContainer ref={setMap} center={[(initial ?? start).lat, (initial ?? start).lng]} zoom={initial ? 16 : 14} zoomControl={false} className="leaflet-map">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          <ClickToSet onPick={setP} />
          {p && <Marker position={[p.lat, p.lng]} icon={pin} />}
        </MapContainer>
      </div>
      <div className="map-picker-foot">
        {p && <p className="mono muted small">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p>}
        <button className="primary-btn" disabled={!p} onClick={() => p && onDone(p)}>{p ? 'Use this spot' : 'Search or tap the map to choose a spot'}</button>
      </div>
    </div>
  );
}
