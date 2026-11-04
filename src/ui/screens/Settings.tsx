import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';

export function Settings({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, snaps, persisted, exportData, importData, resetAll, toast, geo, requestLocation } = useStore();
  const [name, setName] = useState(settings.username);
  const [armed, setArmed] = useState(false);
  const [usage, setUsage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = snaps.filter((s) => s.source === 'mine').length;

  useEffect(() => { setName(settings.username); }, [settings.username]);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`)).catch(() => {});
  }, [snaps.length]);

  const saveName = () => {
    const clean = name.trim().replace(/[^\w.-]/g, '').slice(0, 24);
    if (!clean) { setName(settings.username); return; }
    if (clean !== settings.username) { updateSettings({ username: clean }); toast(`You're now @${clean}`); }
    setName(clean);
  };

  return (
    <section className="view" aria-label="Settings">
      <div className="form-head">
        <div><p className="eyebrow">Catdex</p><h1>Settings</h1></div>
        <button className="pill-btn" onClick={onBack}><Icon name="back" />Back</button>
      </div>

      <div className="settings">
        <div className="set-group">
          <label className="set-row" htmlFor="username">
            <span><strong>Username</strong><span className="muted small">Shown on your snaps and comments.</span></span>
            <input id="username" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          </label>
          <label className="set-row">
            <span><strong>Show demo cats</strong><span className="muted small">Example cats (including Claude) placed around you. Turn off to see only your own snaps.</span></span>
            <input type="checkbox" className="switch" checked={settings.showDemo} onChange={(e) => updateSettings({ showDemo: e.target.checked })} />
          </label>
          <label className="set-row">
            <span><strong>Plus (mock)</strong><span className="muted small">Try the paid tier. No payment.</span></span>
            <input type="checkbox" className="switch" checked={settings.plus} onChange={(e) => updateSettings({ plus: e.target.checked })} />
          </label>
        </div>

        <div className="set-group">
          <div className="set-row">
            <span><strong>Location</strong><span className="muted small">
              {geo.status === 'live' ? `GPS live, accurate to about ${Math.round(geo.accuracy ?? 0)} m.` :
                geo.status === 'denied' ? 'Blocked. Allow location for this site in your browser settings, then tap Retry.' :
                geo.status === 'pending' ? 'Waiting for GPS…' : 'Not available on this device.'}
            </span></span>
            {geo.status !== 'live' && <button className="pill-btn" onClick={requestLocation}>Retry</button>}
          </div>
          <div className="set-row">
            <span><strong>On-device storage</strong><span className="muted small">
              {mine} snap{mine === 1 ? '' : 's'}{usage ? ` · ${usage}` : ''} · {persisted ? 'protected from automatic clean-up' : 'the browser may clear this if space runs low, so back up regularly'}
            </span></span>
          </div>
        </div>

        <div className="set-group">
          <p className="set-title"><Icon name="shield" /> Backup</p>
          <p className="muted small">Your snaps live only on this phone. Save a backup file now and then, especially before clearing browser data or switching phones.</p>
          <div className="set-actions">
            <button className="pill-btn dark" onClick={() => exportData().then(() => toast('Backup saved to your downloads')).catch(() => toast('Backup failed. Try again.'))}><Icon name="download" />Save backup</button>
            <button className="pill-btn" onClick={() => fileRef.current?.click()}><Icon name="upload" />Restore backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importData(f).catch((err) => toast(err instanceof Error ? err.message : 'Restore failed.'));
            }} />
          </div>
        </div>

        <div className="set-group">
          <p className="set-title">Field-testing tips</p>
          <ul className="tips">
            <li>Add Cat Snap to your home screen so it opens full screen and works offline.</li>
            <li>Open the Radar once on Wi-Fi in a new area. Map tiles you've viewed are kept for offline use.</li>
            <li>Use "Saw them again" on a cat you've already snapped instead of making a duplicate.</li>
          </ul>
        </div>

        <button className={`ghost-btn ${armed ? 'armed' : ''}`} onClick={async () => {
          if (!armed) { setArmed(true); window.setTimeout(() => setArmed(false), 4000); return; }
          setArmed(false);
          await resetAll();
          toast('All Cat Snap data on this phone was deleted');
        }}>{armed ? 'Tap again to delete all snaps, photos and settings' : 'Delete all data on this phone'}</button>
        <p className="version mono">Cat Snap field test · v{__APP_VERSION__}</p>
      </div>
    </section>
  );
}
