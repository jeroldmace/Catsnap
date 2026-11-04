import { ADS } from '../../core/demo';
import { Icon } from './Icon';

/** Mock sponsored card shown to Free users. */
export function AdCard({ n, onRemoveAds, onTap }: { n: number; onRemoveAds: () => void; onTap: () => void }) {
  const ad = ADS[n % ADS.length];
  const glyph = ['globe', 'bell', 'heart'][n % 3];
  return (
    <aside className="ad-card" aria-label="Advertisement">
      <div className="ad-art" style={{ background: `linear-gradient(135deg, ${ad.hue}, color-mix(in srgb, ${ad.hue} 60%, #000))` }}><Icon name={glyph} /></div>
      <div className="ad-body">
        <div className="ad-tag"><span>Sponsored</span><button onClick={onRemoveAds}>Remove ads</button></div>
        <span className="ad-brand">{ad.brand}</span>
        <span className="ad-line">{ad.line}</span>
        <button className="ad-cta" onClick={onTap}>{ad.cta}</button>
      </div>
    </aside>
  );
}
