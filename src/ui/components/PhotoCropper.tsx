import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Icon } from './Icon';

const SHAPES = [
  { label: '4:3', aspect: 4 / 3 },
  { label: 'Square', aspect: 1 },
  { label: '3:4', aspect: 3 / 4 },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Cloud photos come from signed storage links; load them CORS-clean so the canvas can export.
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't open that photo for cropping."));
    img.src = src;
  });
}

/** Draw the chosen area (after rotating the photo) into a new JPEG. */
export async function cropImage(src: string, area: Area, rotation: number): Promise<Blob> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
  const bw = img.width * cos + img.height * sin;
  const bh = img.width * sin + img.height * cos;

  // Rotate the whole photo onto a canvas the size of its rotated bounding box…
  const rotated = document.createElement('canvas');
  rotated.width = Math.round(bw);
  rotated.height = Math.round(bh);
  const rctx = rotated.getContext('2d')!;
  rctx.translate(bw / 2, bh / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);

  // …then cut out the selected area.
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(area.width));
  out.height = Math.max(1, Math.round(area.height));
  out.getContext('2d')!.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('Cropping failed.'))), 'image/jpeg', 0.92));
}

interface Props { src: string; onDone: (blob: Blob) => void; onCancel: () => void }

export function PhotoCropper({ src, onDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(SHAPES[0].aspect);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onComplete = useCallback((_a: Area, pixels: Area) => setArea(pixels), []);

  const done = async () => {
    if (!area) return;
    setBusy(true);
    try { onDone(await cropImage(src, area, rotation)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Cropping failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="cropper" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className="cropper-head">
        <button className="pill-btn" onClick={onCancel}><Icon name="x" />Cancel</button>
        <strong>Crop photo</strong>
        <button className="pill-btn dark" disabled={!area || busy} onClick={done}>{busy ? '…' : 'Done'}</button>
      </div>
      <div className="cropper-stage">
        <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect}
          onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={onComplete}
          minZoom={1} maxZoom={5} showGrid disableAutomaticStylesInjection />
      </div>
      <div className="cropper-tools">
        {err && <p className="warn small">{err}</p>}
        <label className="cropper-zoom">
          <span className="muted small">Zoom</span>
          <input type="range" min={1} max={5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
        </label>
        <div className="cropper-row">
          <div className="seg">
            {SHAPES.map((s) => <button key={s.label} className={aspect === s.aspect ? 'active' : ''} onClick={() => setAspect(s.aspect)}>{s.label}</button>)}
          </div>
          <button className="pill-btn" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate 90 degrees">↻ Rotate</button>
        </div>
      </div>
    </div>
  );
}
