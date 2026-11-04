import { useStore } from '../store';
import { Icon, Paw } from './Icon';

export function Welcome() {
  const { updateSettings, requestLocation, geo } = useStore();
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to Cat Snap">
      <div className="welcome-card">
        <div className="avatar"><Paw /></div>
        <h1>Welcome to Cat Snap</h1>
        <p>A field log for cats you meet out in the world: strays, trail cats, temple guardians and market mousers.</p>
        <ul>
          <li><Icon name="camera" /><span><strong>Snap and rate</strong> cats outdoors. No pets at home.</span></li>
          <li><Icon name="radar" /><span><strong>Cat Radar</strong> shows recent sightings near you.</span></li>
          <li><Icon name="lock" /><span><strong>Cat-safe:</strong> every location is blurred about 100 m and photo GPS data is stripped.</span></li>
          <li><Icon name="shield" /><span><strong>Private:</strong> this field-test build keeps everything on your phone.</span></li>
        </ul>
        <button className="primary-btn" onClick={() => { requestLocation(); updateSettings({ onboarded: true }); }}>
          {geo.status === 'live' ? 'Start exploring' : 'Allow location and start'}
        </button>
      </div>
    </div>
  );
}
