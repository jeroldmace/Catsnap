import { rankFor } from '../../core/rules';
import { useStore } from '../store';
import { CatArt } from '../components/CatArt';
import { RarityBadge } from '../components/bits';
import { Icon, Paw } from '../components/Icon';

interface Props { onOpen: (id: string) => void; onPlus: () => void; onSettings: () => void; onSnap: () => void }

export function Catdex({ onOpen, onPlus, onSettings, onSnap }: Props) {
  const { snaps, points, settings } = useStore();
  const mine = snaps.filter((s) => s.source === 'mine').sort((a, b) => b.createdAt - a.createdAt);
  const habitats = new Set(mine.map((s) => s.habitat));
  const logged = snaps.reduce((a, s) => a + s.mySightings.length, 0);
  const badges = [
    { i: 'camera', name: 'First Snap', got: mine.length >= 1 },
    { i: 'globe', name: 'Trail Blazer', got: habitats.has('wild') },
    { i: 'sparkle', name: 'Culture Cat', got: habitats.has('attraction') },
    { i: 'pin', name: 'Salty Paws', got: habitats.has('harbour') },
    { i: 'radar', name: 'Globetrotter', got: habitats.size >= 5 },
    { i: 'crown', name: 'Legend Hunter', got: mine.some((s) => s.rarity.tier === 3) },
    { i: 'eye', name: 'Witness', got: logged >= 3 },
    { i: 'book', name: 'Collector', got: mine.length >= 10 },
  ];
  return (
    <section className="view" aria-label="Your Catdex">
      <div className="dex-head">
        <div className="avatar"><Paw /></div>
        <div className="grow">
          <h1>@{settings.username}</h1>
          <p className="muted">{rankFor(points)}{settings.plus ? ' · Plus member' : ''}</p>
        </div>
        <button className="icon-btn" aria-label="Settings" onClick={onSettings}><Icon name="gear" /></button>
      </div>
      <div className="stats">
        <div><strong>{mine.length}</strong><span>Snaps</span></div>
        <div><strong>{logged}</strong><span>Sightings</span></div>
        <div><strong>{habitats.size}/5</strong><span>Habitats</span></div>
        <div><strong>{points}</strong><span>Points</span></div>
      </div>
      {!settings.plus && (
        <div className="upsell">
          <div><strong>Cat Snap Plus</strong><p>Detailed stats, trip journals and a 25 km radar.</p></div>
          <button onClick={onPlus}>See Plus</button>
        </div>
      )}
      <h2>Badges</h2>
      <div className="badges">
        {badges.map((b) => <div key={b.name} className={`badge ${b.got ? 'got' : ''}`} title={b.name}><span className="medal"><Icon name={b.i} /></span>{b.name}</div>)}
      </div>
      <h2>Your snaps</h2>
      <div className="dex-grid">
        {mine.length === 0 && (
          <div className="empty">
            Your Catdex is empty. Head outside and snap your first cat.
            <button className="pill-btn dark" style={{ margin: '12px auto 0' }} onClick={onSnap}><Icon name="camera" />Snap a cat</button>
          </div>
        )}
        {mine.map((s) => (
          <button key={s.id} className="dex-item" onClick={() => onOpen(s.id)}>
            <CatArt photoSrc={s.photoSrc} name={s.name} coat={s.coat} eyes={s.eyes} habitat={s.habitat} />
            <RarityBadge r={s.rarity} inline />
            <strong>{s.name}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
