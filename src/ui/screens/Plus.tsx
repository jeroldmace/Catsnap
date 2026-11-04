import { useStore } from '../store';
import { Icon } from '../components/Icon';

const COMPARE: [string, string, string][] = [
  ['Snapping', 'Unlimited snaps, ratings, notes', 'Plus multi-photo snaps and full-resolution backup'],
  ['Radar range', '1 or 3 km', 'Up to 25 km'],
  ['Radar history', 'Last 24 h', 'Up to 30 days'],
  ['Radar filters', '—', 'Rare+ and Legendary only'],
  ['Travel mode', '—', 'Preview the radar in another city'],
  ['Rare-cat alerts', '—', '"A Rare cat was snapped within 2 km"'],
  ['Catdex', 'Snaps, points, badges', 'Detailed stats, maps, trip journals'],
  ['Ads', 'Shown in feed and radar', 'None'],
];

export function Plus({ onActivated }: { onActivated: () => void }) {
  const { settings, updateSettings, toast, setTravel } = useStore();
  const toggle = async () => {
    const plus = !settings.plus;
    await updateSettings({ plus });
    if (!plus) setTravel(null);
    toast(plus ? 'Plus is on. Mock only, no payment taken.' : 'Back on Free. Ads and radar limits are back.');
    if (plus) onActivated();
  };
  return (
    <section className="view" aria-label="Cat Snap Plus">
      <div className="plus-hero">
        <div className="plus-rings" aria-hidden="true"><i /><i /><i /></div>
        <p className="plus-badge"><Icon name="crown" /> Cat Snap Plus</p>
        <h1>See further.<br />Wander further.</h1>
        <p>No ads, a 25 km radar with 30 days of history, travel mode, and rare-cat alerts.</p>
      </div>
      <div className="billing" role="radiogroup" aria-label="Billing period">
        <button role="radio" aria-checked={settings.plan === 'year'} className={settings.plan === 'year' ? 'active' : ''} onClick={() => updateSettings({ plan: 'year' })}>
          <span className="plan-name">Yearly</span>
          <span className="plan-price"><strong>$24.99</strong>/yr</span>
          <span className="plan-sub mono">$2.08/mo · save 48%</span>
          <span className="plan-flag">Best value</span>
        </button>
        <button role="radio" aria-checked={settings.plan === 'month'} className={settings.plan === 'month' ? 'active' : ''} onClick={() => updateSettings({ plan: 'month' })}>
          <span className="plan-name">Monthly</span>
          <span className="plan-price"><strong>$3.99</strong>/mo</span>
          <span className="plan-sub mono">cancel any time</span>
        </button>
      </div>
      <button className={`primary-btn ${settings.plus ? 'quiet' : 'gold'}`} onClick={toggle}>
        {settings.plus ? 'Switch back to Free (mock)' : 'Start 7-day free trial'}
      </button>
      <p className="mock-note">Field-test build: no payment is taken. This switches the app into Plus mode so you can try it.</p>
      <h2>Free vs Plus</h2>
      <div className="compare-wrap">
        <table className="compare">
          <thead><tr><th /><th>Free</th><th className="col-plus">Plus</th></tr></thead>
          <tbody>
            {COMPARE.map(([f, free, plus]) => (
              <tr key={f}><td>{f}</td><td className={free === '—' ? 'no' : ''}>{free}</td><td className="col-plus">{plus}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="promise">
        <h2>Never for sale</h2>
        <p className="muted">Some things stay the same for everyone, to keep cats safe and the game fair.</p>
        <ul>
          <li><span><Icon name="pin" /></span><div><strong>Location privacy</strong><span>Blurring and delayed sharing are free for everyone.</span></div></li>
          <li><span><Icon name="sparkle" /></span><div><strong>Points and rarity</strong><span>You earn them by finding cats, never by paying.</span></div></li>
          <li><span><Icon name="camera" /></span><div><strong>Posting</strong><span>Unlimited snaps for every member.</span></div></li>
        </ul>
      </div>
      <p className="tnr-note"><Icon name="heart" /> 5% of every Plus subscription goes to local trap-neuter-return groups.</p>
    </section>
  );
}
