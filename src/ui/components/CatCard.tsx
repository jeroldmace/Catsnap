import { formatDistance, timeAgo } from '../../core/geo';
import type { SnapView } from '../store';
import { CatArt } from './CatArt';
import { HabitatTag, RarityBadge, ScoreChip } from './bits';
import { Icon } from './Icon';

interface Props { s: SnapView; onOpen: (id: string) => void; onLike: (id: string) => void; onEdit?: (id: string) => void }

export function CatCard({ s, onOpen, onLike, onEdit }: Props) {
  const fresh = Date.now() - s.lastSeen < 3600000;
  return (
    <article className={`card r${s.rarity.tier}`} onClick={() => onOpen(s.id)}>
      <div className="card-art">
        <CatArt photoSrc={s.photoSrc} name={s.name} coat={s.coat} eyes={s.eyes} habitat={s.habitat} />
        <RarityBadge r={s.rarity} />
        {fresh && <span className="new-flag">NEW</span>}
        <div className="art-title"><h3>{s.name}</h3><ScoreChip score={s.score} /></div>
      </div>
      <div className="card-body">
        <div className="spot-line"><Icon name="pin" /><span>{s.spot}</span></div>
        <div className="field-line"><HabitatTag h={s.habitat} /><span className="mono">{formatDistance(s.distanceKm)} · {timeAgo(s.lastSeen)}</span></div>
        <div className="card-foot">
          <div className="actions">
            <button className={`act ${s.liked ? 'liked' : ''}`} aria-label={s.liked ? 'Unlike' : 'Like'}
              onClick={(e) => { e.stopPropagation(); onLike(s.id); }}>
              <Icon name={s.liked ? 'heartF' : 'heart'} />{s.likes}
            </button>
            <span className="act" aria-label="Comments"><Icon name="comment" />{s.comments.length}</span>
            <span className="act" aria-label="Sightings"><Icon name="eye" />{s.sightingCount}</span>
          </div>
          {s.source === 'mine' && onEdit
            ? <button className="act edit-chip" onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}><Icon name="edit" />Edit</button>
            : <span className="byline">{s.source === 'example' ? 'Example' : `@${s.author}`}</span>}
        </div>
      </div>
    </article>
  );
}
