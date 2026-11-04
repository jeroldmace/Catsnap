import { useEffect, useMemo, useRef, useState } from 'react';
import { catSVG } from '../../core/catArt';
import { COATS, EYES, HABITATS, RATING_KEYS } from '../../core/catalog';
import { MAX_TAGS, addTag, tagKey, tagPopularity } from '../../core/tags';
import { rarityOf } from '../../core/rules';
import type { CoatKey, EyeKey, GeoPoint, HabitatKey, Ratings, Visibility } from '../../core/types';
import { VISIBILITY_LABEL } from './Settings';
import { POST_FRESH_MS, useStore, type SnapDraft } from '../store';
import { Icon, Paw } from '../components/Icon';
import { LocationHelp } from '../components/LocationHelp';
import { MapPicker } from '../components/MapPicker';

interface Props { editId: string | null; onDone: (id: string) => void; onCancelEdit: () => void }

const blank = (visibility: Visibility = 'shared'): SnapDraft => ({
  name: '', coat: 'orange', eyes: 'amber', habitat: 'street', spot: '', notes: '', tags: [],
  ratings: { charm: 3, fluff: 3, pose: 3, friendly: 3 }, visibility,
});

export function SnapForm({ editId, onDone, onCancelEdit }: Props) {
  const { snaps, addSnap, editSnap, geo, toast, settings, account, here } = useStore();
  const editing = editId ? snaps.find((s) => s.id === editId && s.source === 'mine') ?? null : null;
  const [d, setD] = useState<SnapDraft>(() => blank(settings.defaultVisibility));
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined); // undefined = unchanged (edit)
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState<GeoPoint | null>(null);
  const [picking, setPicking] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const popular = useMemo(() => tagPopularity(snaps.filter((s) => s.source !== 'example')), [snaps]);

  // Load the snap being edited, or reset for a new one.
  useEffect(() => {
    if (editing) {
      const { name, coat, eyes, habitat, spot, notes, tags, ratings, visibility } = editing;
      setD({ name, coat, eyes, habitat, spot, notes, tags: [...tags], ratings: { ...ratings }, visibility: visibility ?? 'shared' });
      setPreview(editing.photoSrc);
      setConfirmed(true);
    } else {
      setD(blank(settings.defaultVisibility)); setPreview(null); setConfirmed(false);
    }
    setPhoto(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => () => { if (preview?.startsWith('blob:') && photo) URL.revokeObjectURL(preview); }, [preview, photo]);

  const set = <K extends keyof SnapDraft>(k: K, v: SnapDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setRating = (k: keyof Ratings, v: number) => setD((x) => ({ ...x, ratings: { ...x.ratings, [k]: v } }));
  const toggleTag = (t: string) => setD((x) => {
    if (x.tags.some((y) => tagKey(y) === tagKey(t))) return { ...x, tags: x.tags.filter((y) => tagKey(y) !== tagKey(t)) };
    if (x.tags.length >= MAX_TAGS) { toast(`Up to ${MAX_TAGS} tags per snap.`); return x; }
    return { ...x, tags: addTag(x.tags, t) };
  });
  const submitTag = () => {
    const next = addTag(d.tags, tagInput);
    if (next === d.tags && tagInput.trim()) toast(d.tags.length >= MAX_TAGS ? `Up to ${MAX_TAGS} tags per snap.` : 'That tag is already added or empty.');
    set('tags', next);
    setTagInput('');
  };
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
        const id = await addSnap(draft, photo ?? null, manual);
        toast(`Posted. ${forecast.name} find, +${forecast.points} pts`);
        setD(blank(settings.defaultVisibility)); setPhoto(undefined); setPreview(null); setConfirmed(false); setManual(null);
        onDone(id);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const freshFix = !!geo.point && !!geo.updatedAt && Date.now() - geo.updatedAt <= POST_FRESH_MS;

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
              <li>Keep people's faces and house numbers out of the photo.</li>
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
          <label htmlFor="tagInput">Tags <span className="muted small">({d.tags.length}/{MAX_TAGS}) · most popular first</span></label>
          {d.tags.length > 0 && (
            <div className="tag-picker chosen">
              {d.tags.map((t) => <button type="button" key={t} className="active" aria-label={`Remove tag ${t}`} onClick={() => toggleTag(t)}>{t} <Icon name="x" /></button>)}
            </div>
          )}
          <div className="tag-add">
            <input id="tagInput" value={tagInput} maxLength={30} placeholder="Add your own tag, e.g. Loves boxes"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); submitTag(); } }} />
            <button type="button" className="pill-btn" onClick={submitTag} disabled={!tagInput.trim()}><Icon name="plus" />Add</button>
          </div>
          <div className="tag-picker">
            {popular.filter((p) => !d.tags.some((t) => tagKey(t) === tagKey(p.tag)))
              .filter((p) => !tagInput.trim() || tagKey(p.tag).includes(tagKey(tagInput.trim())))
              .slice(0, showAllTags ? 200 : 16)
              .map((p) => (
                <button type="button" key={p.tag} onClick={() => toggleTag(p.tag)}>{p.tag}{p.count > 0 && <span className="tag-count">{p.count}</span>}</button>
              ))}
            {!showAllTags && popular.length > 16 && <button type="button" className="tag-more" onClick={() => setShowAllTags(true)}>More…</button>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">Field notes</label>
          <textarea id="notes" rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} maxLength={400} placeholder="What were they doing? Any distinguishing marks?" />
        </div>

        <div className="field">
          <label>Who can see this snap?</label>
          <div className="vis-picker">
            {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
              <button type="button" key={v} className={d.visibility === v ? 'active' : ''} aria-pressed={d.visibility === v} onClick={() => set('visibility', v)}>
                <strong>{VISIBILITY_LABEL[v].title}</strong><span>{VISIBILITY_LABEL[v].detail}</span>
              </button>
            ))}
          </div>
          {!account && <span className="muted small">You're not signed in, so this snap stays on your phone for now. It's shared this way once you sign in.</span>}
        </div>

        {!editing && (
          <label className="confirm">
            <input type="checkbox" id="wildConfirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>I met this cat outside or in public, and it isn't my pet or someone's indoor cat.</span>
          </label>
        )}

        {editing ? (
          <div className="loc-line"><Icon name="pin" /><span>Location stays where you first snapped this cat.</span></div>
        ) : manual ? (
          <div className="loc-line"><Icon name="pin" /><span>Pinned at the spot you chose on the map, blurred about 100 m before saving.</span>
            <button type="button" className="pill-btn" onClick={() => setPicking(true)}>Change</button>
            <button type="button" className="pill-btn" onClick={() => setManual(null)}>Use GPS</button>
          </div>
        ) : freshFix ? (
          <div className="loc-line"><Icon name="pin" /><span>Pinned at your GPS position (±{Math.round(geo.accuracy ?? 0)} m), blurred about 100 m before saving.</span>
            <button type="button" className="pill-btn" onClick={() => setPicking(true)}>Type or pick instead</button>
          </div>
        ) : (
          <div className="field">
            <LocationHelp suffix="You can keep filling in the entry." />
            <button type="button" className="pill-btn dark" onClick={() => setPicking(true)}><Icon name="map" />Type the place or pick it on a map</button>
          </div>
        )}
        {!editing && <p className="forecast">This looks like a <strong>{forecast.name}</strong> find: +{forecast.points} pts.</p>}

        <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Post snap'}</button>
      </form>
      {picking && <MapPicker start={geo.point ?? here} initial={manual} onCancel={() => setPicking(false)} onDone={(p) => { setManual(p); setPicking(false); }} />}
    </section>
  );
}
