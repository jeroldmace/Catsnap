import { useMemo, useState } from 'react';
import { HABITATS } from '../../core/catalog';
import { tagKey, tagPopularity } from '../../core/tags';
import type { HabitatKey } from '../../core/types';
import { useStore, type SnapView } from '../store';
import { AdCard } from '../components/AdCard';
import { CatCard } from '../components/CatCard';
import { Icon } from '../components/Icon';

type Sort = 'popular' | 'recent' | 'nearby' | 'top' | 'rare';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'popular', label: 'Popular' }, { key: 'recent', label: 'Recent' }, { key: 'nearby', label: 'Nearby' }, { key: 'top', label: 'Top rated' }, { key: 'rare', label: 'Rare finds' },
];
/**
 * Popularity: likes, comments and extra sightings, cooled by age so new finds
 * can rise (a "hot" ranking). Ties fall back to the newest.
 */
export function popularity(s: SnapView, now = Date.now()): number {
  const engagement = s.likes + 2 * s.comments.length + 2 * Math.max(0, s.sightingCount - 1) + 1;
  const hours = Math.max(0, (now - s.lastSeen) / 3600000);
  return engagement / Math.pow(hours + 2, 1.2);
}
const sorters: Record<Sort, (a: SnapView, b: SnapView) => number> = {
  popular: (a, b) => popularity(b) - popularity(a) || b.lastSeen - a.lastSeen,
  recent: (a, b) => b.lastSeen - a.lastSeen,
  nearby: (a, b) => a.distanceKm - b.distanceKm,
  top: (a, b) => b.score - a.score || b.likes - a.likes,
  rare: (a, b) => b.rarity.tier - a.rarity.tier || b.lastSeen - a.lastSeen,
};
const AD_EVERY = 5;

interface Props { onOpen: (id: string) => void; onPlus: (feature?: string) => void; onSnap: () => void; onEdit: (id: string) => void }

export function Feed({ onOpen, onPlus, onSnap, onEdit }: Props) {
  const { snaps, toggleLike, settings, toast, account } = useStore();
  const [sort, setSort] = useState<Sort>('popular');
  const [habitat, setHabitat] = useState<HabitatKey | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const popularTags = useMemo(() => tagPopularity(snaps.filter((s) => s.source !== 'example'), []).filter((t) => t.count > 0).slice(0, 15), [snaps]);
  // Real cats first in the chosen order; the built-in example cat always sits at the bottom.
  const list = useMemo(() => {
    const matches = snaps.filter((s) => (!habitat || s.habitat === habitat) && (!tag || s.tags.some((t) => tagKey(t) === tagKey(tag))));
    return [...matches.filter((s) => s.source !== 'example').sort(sorters[sort]), ...matches.filter((s) => s.source === 'example')];
  }, [snaps, habitat, tag, sort]);
  const mineCount = snaps.filter((s) => s.source === 'mine').length;

  return (
    <section className="view" aria-label="Feed">
      <div className="feed-intro">
        <p className="eyebrow">Field log · outdoor cats only</p>
        <h1>Who's out there today</h1>
      </div>

      {mineCount === 0 && (
        <button className="first-snap" onClick={onSnap}>
          <span className="first-snap-icon"><Icon name="camera" /></span>
          <span><strong>Snap your first cat</strong><span className="muted small">Next time you meet a cat outside, log it here. Photos stay on your phone.</span></span>
        </button>
      )}


      <div className="chips" role="tablist">
        {SORTS.map((x) => <button key={x.key} role="tab" aria-selected={sort === x.key} className={`chip ${sort === x.key ? 'active' : ''}`} onClick={() => setSort(x.key)}>{x.label}</button>)}
      </div>
      <div className="chips small">
        <button className={`chip ${!habitat ? 'active' : ''}`} onClick={() => setHabitat(null)}>All habitats</button>
        {(Object.keys(HABITATS) as HabitatKey[]).map((k) => (
          <button key={k} className={`chip ${habitat === k ? 'active' : ''}`} onClick={() => setHabitat(k)}>
            <i className="dot" style={{ background: HABITATS[k].color }} />{HABITATS[k].label}
          </button>
        ))}
      </div>

      {popularTags.length > 0 && (
        <div className="chips small" aria-label="Popular tags">
          <span className="chips-label">Popular tags</span>
          {popularTags.map((t) => (
            <button key={t.tag} className={`chip ${tag && tagKey(tag) === tagKey(t.tag) ? 'active' : ''}`} onClick={() => setTag(tag && tagKey(tag) === tagKey(t.tag) ? null : t.tag)}>
              #{t.tag}<span className="tag-count">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="feed">
        {list.length === 0 && <p className="empty">No cats here yet. {account ? 'Snap one, or check back as other spotters share theirs.' : 'Snap one, or sign in (Catdex → Settings) to see cats shared by other spotters.'}</p>}
        {list.flatMap((s, i) => {
          const out = [<CatCard key={s.id} s={s} onOpen={onOpen} onLike={toggleLike} onEdit={onEdit} />];
          if (!settings.plus && (i + 1) % AD_EVERY === 0)
            out.push(<AdCard key={`ad-${i}`} n={Math.floor(i / AD_EVERY)} onRemoveAds={() => onPlus('Ad-free browsing')} onTap={() => toast('Mock ad. In the real app this opens the advertiser.')} />);
          return out;
        })}
      </div>
    </section>
  );
}
