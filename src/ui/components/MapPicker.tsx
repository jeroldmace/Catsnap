import { useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { GeoPoint } from '../../core/types';
import { Icon } from './Icon';

const pin = L.divIcon({ className: '', html: '<div class="pick-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 13] });

function ClickToSet({ onPick }: { onPick: (p: GeoPoint) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Full-screen map to choose where a cat was seen when GPS can't get a fix. */
export function MapPicker({ start, initial, onDone, onCancel }: { start: GeoPoint; initial: GeoPoint | null; onDone: (p: GeoPoint) => void; onCancel: () => void }) {
  const [p, setP] = useState<GeoPoint | null>(initial);
  return (
    <div className="map-picker" role="dialog" aria-modal="true" aria-label="Choose the spot on a map">
      <div className="map-picker-head">
        <div><strong>Where was the cat?</strong><span className="muted small">Tap the map. The spot is still blurred about 100 m when saved.</span></div>
        <button className="sheet-close static" aria-label="Cancel" onClick={onCancel}><Icon name="x" /></button>
      </div>
      <div className="map-picker-map">
        <MapContainer center={[ (initial ?? start).lat, (initial ?? start).lng ]} zoom={initial ? 16 : 14} zoomControl={false} className="leaflet-map">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          <ClickToSet onPick={setP} />
          {p && <Marker position={[p.lat, p.lng]} icon={pin} />}
        </MapContainer>
      </div>
      <div className="map-picker-foot">
        <button className="primary-btn" disabled={!p} onClick={() => p && onDone(p)}>{p ? 'Use this spot' : 'Tap the map to choose a spot'}</button>
      </div>
    </div>
  );
}
