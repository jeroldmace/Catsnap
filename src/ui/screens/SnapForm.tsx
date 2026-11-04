import { useEffect, useMemo, useRef, useState } from 'react';
import { catSVG } from '../../core/catArt';
import { COATS, EYES, HABITATS, RATING_KEYS, TAGS } from '../../core/catalog';
import { rarityOf } from '../../core/rules';
import type { CoatKey, EyeKey, HabitatKey, Ratings } from '../../core/types';
import { useStore, type SnapDraft } from '../store';
import { Icon, Paw } from '../components/Icon';
import { locationMessage } from '../../data/location';

interface Props { editId: string | null; onDone: (id: string) => void; onCancelEdit: () => void }

const blank = (): SnapDraft => ({
  name: '', coat: 'orange', eyes: 'amber', habitat: 'street', spot: '', notes: '', tags: [],
  ratings: { charm: 3, fluff: 3, pose: 3, friendly: 3 },
});

export function SnapForm({ editId, onDone, onCancelEdit }: Props) {
  const { snaps, addSnap, editSnap, geo, toast, requestLocation } = useStore();
  const editing = editId ? snaps.find((s) => s.id === editId && s.source === 'mine') ?? null : null;
  const [d, setD] = useState<SnapDraft>(blank);
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined); // undefined = unchanged (edit)
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the snap being edited, or reset for a new one.
  useEffect(() => {
    if (editing) {
      const { name, coat, eyes, habitat, spot, notes, tags, ratings } = editing;
      setD({ name, coat, eyes, habitat, spot, notes, tags: [...tags], ratings: { ...ratings } });
      setPreview(editing.photoSrc);
      setConfirmed(true);
    } else {
      setD(blank()); setPreview(null); setConfirmed(false);
    }
    setPhoto(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => () => { if (preview?.startsWith('blob:') && photo) URL.revokeObjectURL(preview); }, [preview, photo]);

  const set = <K extends keyof SnapDraft>(k: K, v: SnapDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setRating = (k: keyof Ratings, v: number) => setD((x) => ({ ...x, ratings: { ...x.ratings, [k]: v } }));
  const toggleTag = (t: string) => setD((x) => ({ ...x, tags: x.tags.includes(t) ? x.tags.filter((y) => y !== t) : [...x.tags, t] }));
  const sketch = useMemo(() => catSVG({ coat: d.coat, eyes: d.eyes, bg: HABITATS[d.habitat].bg }), [d.coat, d.eyes, d.habitat]);
  const forecast = rarityOf(d, editing ? editing.sightingCount : 1);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('Pick a photo (JPEG, PNG or HEIC).'); return; }
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.name.trim() || !d.spot.trim()) { toast('Add a name and a spot name.'); return; }
    if (!confirmed) { toast('Cat Snap is only for cats met out in the world. Tick the confirmation.'); return; }
    setSaving(true);
    try {
      const draft = { ...d, name: d.name.trim(), spot: d.spot.trim(), notes: d.notes.trim() };
      if (editing) {
        await editSnap(editing.id, draft, photo);
        toast('Snap updated');
        onDone(editing.id);
      } else {
        const id = await addSnap(draft, photo ?? null);
        toast(`Posted. ${forecast.name} find, +${forecast.points} pts`);
        setD(blank()); setPhoto(undefined); setPreview(null); setConfirmed(false);
        onDone(id);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const locLine = editing ? 'Location stays where you first snapped this cat.'
    : geo.point ? `Pinned at your GPS position (±${Math.round(geo.accuracy ?? 0)} m), blurred about 100 m before saving.`
    : `${locationMessage(geo.status, geo.accuracy, false)} You can fill in the entry meanwhile; posting needs a location.`;
  const locBad = !editing && !geo.point && (geo.status === 'off' || geo.status === 'denied');

  return (
    <section className="view" aria-label={editing ? 'Edit snap' : 'Snap a cat'}>
      <form className="snap-form" onSubmit={submit} autoComplete="off">
        <div className="form-head">
          <div>
            <p className="eyebrow">{editing ? 'Edit field entry' : 'New field entry'}</p>
            <h1>{editing ? `Edit ${editing.name}` : 'Snap a cat'}</h1>
          </div>
          {editing && <button type="button" className="pill-btn" onClick={onCancelEdit}><Icon name="x" />Cancel</button>}
        </div>

        {!editing && (
          <div className="rules">
            <strong>House rules</strong>
            <ul>
              <li>Only cats you meet <em>out in the world</em>: streets, trails, attractions, harbours.</li>
              <li>No pets at home, no cats you own, no pet-shop or shelter listings.</li>
              <li>Don't chase, pick up, or feed a cat without permission.</li>
            </ul>
          </div>
        )}

        <input ref={fileRef} id="photoInput" type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <input id="libraryInput" type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="photo-preview">
          {preview ? <img src={preview} alt="Your photo" /> : <div className="sketch" dangerouslySetInnerHTML={{ __html: sketch }} />}
          {!preview && <span className="muted small">No photo? We'll use this sketch, drawn from the coat and eyes you pick.</span>}
          <div className="photo-actions">
            <button type="button" className="pill-btn dark" onClick={() => fileRef.current?.click()}><Icon name="camera" />{preview ? 'Retake' : 'Take photo'}</button>
            <button type="button" className="pill-btn" onClick={() => document.getElementById('libraryInput')?.click()}><Icon name="image" />From library</button>
            {preview && <button type="button" className="pill-btn" onClick={() => { setPhoto(null); setPreview(null); }}><Icon name="trash" />Remove</button>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="catName">Name or nickname</label>
          <input id="catName" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={40} placeholder="e.g. Admiral Whiskers" required />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="coat">Coat</label>
            <select id="coat" value={d.coat} onChange={(e) => set('coat', e.target.value as CoatKey)}>
              {Object.entries(COATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="eyes">Eyes</label>
            <select id="eyes" value={d.eyes} onChange={(e) => set('eyes', e.target.value as EyeKey)}>
              {Object.entries(EYES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Where did you find them?</label>
          <div className="habitat-picker">
            {(Object.keys(HABITATS) as HabitatKey[]).map((k) => (
              <button type="button" key={k} className={d.habitat === k ? 'active' : ''} aria-pressed={d.habitat === k} onClick={() => set('habitat', k)}>
                <i className="dot" style={{ background: HABITATS[k].color }} />{HABITATS[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="spot">Spot name</label>
          <input id="spot" value={d.spot} onChange={(e) => set('spot', e.target.value)} maxLength={60} placeholder="e.g. Lighthouse trail, north gate" required />
        </div>

        <div className="field">
          <label>Rate this cat</label>
          <div className="rating-grid">
            {RATING_KEYS.map((k) => (
              <div className="rate" key={k.key}>
                <span>{k.label}</span>
                <div className="paw-input">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} className={n <= d.ratings[k.key] ? 'on' : ''} aria-label={`${k.label} ${n} of 5`} onClick={() => setRating(k.key, n)}><Paw /></button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Personality</label>
          <div className="tag-picker">
            {TAGS.map((t) => <button type="button" key={t} className={d.tags.includes(t) ? 'active' : ''} aria-pressed={d.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>)}
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">Field notes</label>
          <textarea id="notes" rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} maxLength={400} placeholder="What were they doing? Any distinguishing marks?" />
        </div>

        {!editing && (
          <label className="confirm">
            <input type="checkbox" id="wildConfirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>I met this cat outside or in public, and it isn't my pet or someone's indoor cat.</span>
          </label>
        )}

        <div className={`loc-line ${locBad ? 'warn' : ''}`}><Icon name="pin" /><span>{locLine}</span>
          {!editing && !geo.point && <button type="button" className="pill-btn" onClick={requestLocation}>Retry</button>}
        </div>
        {!editing && <p className="forecast">This looks like a <strong>{forecast.name}</strong> find: +{forecast.points} pts.</p>}

        <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Post snap'}</button>
      </form>
    </section>
  );
}
