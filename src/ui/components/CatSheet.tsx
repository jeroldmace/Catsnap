import { useEffect, useRef, useState } from 'react';
import { COATS, EYES, RATING_KEYS } from '../../core/catalog';
import { formatDistance, timeAgo } from '../../core/geo';
import { useStore } from '../store';
import { CatArt } from './CatArt';
import { HabitatTag, Meter, RarityBadge } from './bits';
import { Icon } from './Icon';
import { VISIBILITY_LABEL } from '../screens/Settings';

interface Props { id: string | null; onClose: () => void; onEdit: (id: string) => void; onShowOnRadar: (id: string) => void }

export function CatSheet({ id, onClose, onEdit, onShowOnRadar }: Props) {
  const { snaps, toggleLike, addComment, logSighting, deleteSnap, toast, settings, account } = useStore();
  const s = snaps.find((x) => x.id === id) ?? null;
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!id) { setOpen(false); return; }
    setConfirmDelete(false);
    setComment('');
    sheetRef.current?.scrollTo(0, 0);
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!id || !s) return null;
  const mine = s.source === 'mine';
  const iLogged = s.mySightings.some((x) => x.by === settings.username);
  const coat = COATS[s.coat], eyes = EYES[s.eyes];

  const spot = async () => {
    if (await logSighting(s.id)) toast(mine ? 'Sighting logged. Radar now shows where you last saw them.' : 'Sighting logged, +5 pts');
  };
  const del = async () => {
    if (!confirmDelete) { setConfirmDelete(true); window.setTimeout(() => setConfirmDelete(false), 4000); return; }
    await deleteSnap(s.id);
    toast(`Deleted ${s.name}`);
    onClose();
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <article ref={sheetRef} className={`sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={s.name}>
        <span className="sheet-grip" />
        <button className="sheet-close" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        <div className="sheet-art">
          <CatArt photoSrc={s.photoSrc} name={s.name} coat={s.coat} eyes={s.eyes} habitat={s.habitat} lazy={false} />
          <RarityBadge r={s.rarity} points />
        </div>
        <div className="sheet-body">
          <div className="sheet-title">
            <div>
              <h2>{s.name}</h2>
              <div className="field-line" style={{ marginTop: 6 }}>
                <HabitatTag h={s.habitat} /><span className="mono">{formatDistance(s.distanceKm)} · {timeAgo(s.lastSeen)}</span>
              </div>
            </div>
            <div className="big-score"><span className="score">{s.score.toFixed(1)}</span><span>of 5 paws</span></div>
          </div>
          <div className="spot-line"><Icon name="pin" /><span>{s.spot}</span></div>
          <p className="muted small">
            {mine ? 'Your snap' : <>Snapped by <strong>@{s.author}</strong></>} · first seen {timeAgo(s.createdAt)}
            {s.source === 'example' && <span className="demo-tag">Example</span>}
            {s.source === 'mine' && <span className="demo-tag">{VISIBILITY_LABEL[s.visibility ?? 'shared'].title}</span>}
            {s.source === 'mine' && s.syncedAt !== s.updatedAt && account && <span className="demo-tag">Not uploaded yet</span>}
          </p>

          <div className="traits">
            <div><span>Coat</span><strong>{coat?.label ?? 'Unknown'}</strong></div>
            <div><span>Eyes</span><strong>{eyes?.label ?? 'Unknown'}</strong></div>
            <div><span>Sightings</span><strong>{s.sightingCount}</strong></div>
          </div>

          <div className="ratings">
            {RATING_KEYS.map((k) => (
              <div className="rating-row" key={k.key}><span>{k.label}</span><Meter n={s.ratings[k.key]} /><span className="mono">{s.ratings[k.key]}</span></div>
            ))}
          </div>

          {s.tags.length > 0 && <div className="tags">{s.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>}
          {s.notes && <blockquote className="notes">{s.notes}</blockquote>}

          <div className="sheet-actions">
            {!mine && (
              <button className={`pill-btn ${s.liked ? 'liked' : ''}`} onClick={() => toggleLike(s.id)}>
                <Icon name={s.liked ? 'heartF' : 'heart'} />{s.likes}
              </button>
            )}
            <button className={`pill-btn ${iLogged && !mine ? 'on' : ''}`} onClick={spot}>
              <Icon name={iLogged && !mine ? 'check' : 'eye'} />
              {mine ? 'Saw them again' : iLogged ? 'Spotted again' : 'I spotted them too · +5'}
            </button>
            <button className="pill-btn" onClick={() => onShowOnRadar(s.id)}><Icon name="radar" />Show on radar</button>
          </div>
          {mine && (
            <div className="sheet-actions">
              <button className="pill-btn" onClick={() => onEdit(s.id)}><Icon name="edit" />Edit</button>
              <button className={`pill-btn ${confirmDelete ? 'danger' : ''}`} onClick={del}>
                <Icon name="trash" />{confirmDelete ? 'Tap again to delete' : 'Delete'}
              </button>
            </div>
          )}

          {s.mySightings.length > 0 && (
            <>
              <h3>Your sightings</h3>
              <ul className="sighting-log">
                {[...s.mySightings].reverse().map((x) => (
                  <li key={x.at}><span className="mono">{new Date(x.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="muted small">{timeAgo(x.at)}</span></li>
                ))}
              </ul>
            </>
          )}

          <h3>Comments</h3>
          <ul className="comments">
            {s.comments.length ? s.comments.map((c) => <li key={c.id}><strong>@{c.by}</strong>{c.text}</li>)
              : <li className="muted">No comments yet. Add a note for later.</li>}
          </ul>
          <form className="comment-form" onSubmit={async (e) => {
            e.preventDefault();
            const t = comment.trim();
            if (!t) return;
            await addComment(s.id, t);
            setComment('');
          }}>
            <input id="commentText" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={200} placeholder="Add a comment…"
              enterKeyHint="send"
              onFocus={(e) => { const el = e.currentTarget; window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350); }} />
            <button type="submit">Post</button>
          </form>
        </div>
      </article>
    </>
  );
}
