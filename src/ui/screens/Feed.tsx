import { useMemo, useState } from 'react';
import { HABITATS } from '../../core/catalog';
import { formatDistance, timeAgo } from '../../core/geo';
import type { HabitatKey } from '../../core/types';
import { useStore, type SnapView } from '../store';
import { AdCard } from '../components/AdCard';
import { CatArt } from '../components/CatArt';
import { CatCard } from '../components/CatCard';
import { RarityBadge, ScoreChip } from '../components/bits';
import { Icon } from '../components/Icon';

type Sort = 'recent' | 'nearby' | 'top' | 'rare';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' }, { key: 'nearby', label: 'Nearby' }, { key: 'top', label: 'Top rated' }, { key: 'rare', label: 'Rare finds' },
];
const sorters: Record<Sort, (a: SnapView, b: SnapView) => number> = {
  recent: (a, b) => b.lastSeen - a.lastSeen,
  nearby: (a, b) => a.distanceKm - b.distanceKm,
  top: (a, b) => b.score - a.score || b.likes - a.likes,
  rare: (a, b) => b.rarity.tier - a.rarity.tier || b.lastSeen - a.lastSeen,
};
const AD_EVERY = 5;

interface Props { onOpen: (id: string) => void; onPlus: (feature?: string) => void; onSnap: () => void }

export function Feed({ onOpen, onPlus, onSnap }: Props) {
  const { snaps, toggleLike, settings, toast } = useStore();
  const [sort, setSort] = useState<Sort>('recent');
  const [habitat, setHabitat] = useState<HabitatKey | null>(null);
  const featured = snaps.find((s) => s.featured);
  const list = useMemo(() => snaps.filter((s) => !s.featured && (!habitat || s.habitat === habitat)).sort(sorters[sort]), [snaps, habitat, sort]);
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

      {featured && (
        <button className="featured" onClick={() => onOpen(featured.id)} aria-label={`Open ${featured.name}`}>
          <div className="art"><CatArt photoSrc={featured.photoSrc} name={featured.name} coat={featured.coat} eyes={featured.eyes} habitat={featured.habitat} lazy={false} /></div>
          <div className="feat-top">
            <span className="feat-label"><Icon name="sparkle" /> Featured find</span>
            <RarityBadge r={featured.rarity} inline />
          </div>
          <div className="feat-body">
            <h2>{featured.name}</h2>
            <div className="feat-meta">
              <ScoreChip score={featured.score} />
              <span>{featured.spot}</span>
              <span className="mono">{formatDistance(featured.distanceKm)} · {timeAgo(featured.lastSeen)}</span>
            </div>
            <p className="feat-quote">{featured.notes}</p>
          </div>
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

      <div className="feed">
        {list.length === 0 && <p className="empty">No cats here yet. {settings.showDemo ? 'Try another habitat.' : 'Snap one, or turn demo cats on in Settings.'}</p>}
        {list.flatMap((s, i) => {
          const out = [<CatCard key={s.id} s={s} onOpen={onOpen} onLike={toggleLike} />];
          if (!settings.plus && (i + 1) % AD_EVERY === 0)
            out.push(<AdCard key={`ad-${i}`} n={Math.floor(i / AD_EVERY)} onRemoveAds={() => onPlus('Ad-free browsing')} onTap={() => toast('Mock ad. In the real app this opens the advertiser.')} />);
          return out;
        })}
      </div>
    </section>
  );
}
