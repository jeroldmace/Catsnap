import { useEffect, useRef, useState } from 'react';
import type { Visibility } from '../../core/types';
import { timeAgo } from '../../core/geo';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { isNative } from '../../data/platform';
import { LocationHelp } from '../components/LocationHelp';
import { locationDiagnostics } from '../../data/location';

export const VISIBILITY_LABEL: Record<Visibility, { title: string; detail: string }> = {
  shared: { title: 'Shared', detail: 'Other spotters see it right away.' },
  delayed: { title: 'Shared after 1 hour', detail: "Others see it an hour later, so nobody can follow where you are now." },
  private: { title: 'Private', detail: 'Only you. Still backed up to your account.' },
};

export function Settings({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, setUsername, snaps, persisted, exportData, importData, resetAll, toast, geo, account } = useStore();
  const [name, setName] = useState(settings.username);
  const [armed, setArmed] = useState(false);
  const [usage, setUsage] = useState<string | null>(null);
  const [diagText, setDiagText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = snaps.filter((s) => s.source === 'mine').length;

  useEffect(() => { setName(settings.username); }, [settings.username]);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`)).catch(() => {});
  }, [snaps.length]);

  const saveName = async () => {
    if (name.trim().toLowerCase() === settings.username) return;
    try { await setUsername(name); toast(`You're now @${name.trim().toLowerCase()}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't change your username."); setName(settings.username); }
  };

  return (
    <section className="view" aria-label="Settings">
      <div className="form-head">
        <div><p className="eyebrow">You</p><h1>Account &amp; settings</h1></div>
        <button className="pill-btn" onClick={onBack}><Icon name="back" />Back</button>
      </div>

      <div className="settings">
        <div id="account"><AccountPanel /></div>

        {account && <NotificationsPanel />}

        <div className="set-group">
          <p className="set-title"><Icon name="shield" /> Privacy</p>
          <p className="muted small">Snaps are shared in real time with exact locations by default. These options are yours to switch on.</p>
          <div className="set-row column">
            <span><strong>Default for new snaps</strong><span className="muted small">You can change it on each snap.</span></span>
            <div className="vis-picker">
              {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
                <button key={v} className={settings.defaultVisibility === v ? 'active' : ''} aria-pressed={settings.defaultVisibility === v}
                  onClick={() => updateSettings({ defaultVisibility: v })}>
                  <strong>{VISIBILITY_LABEL[v].title}</strong><span>{VISIBILITY_LABEL[v].detail}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="set-row">
            <span><strong>Blur my locations</strong><span className="muted small">Move new snaps and sightings to a random spot about 100 m away. Off by default for exact pins.</span></span>
            <input type="checkbox" className="switch" checked={settings.blurLocations} onChange={(e) => updateSettings({ blurLocations: e.target.checked })} />
          </label>
          <label className="set-row">
            <span><strong>Delay my repeat sightings</strong><span className="muted small">Others see your "saw them again" pins an hour later.</span></span>
            <input type="checkbox" className="switch" checked={settings.delaySightings} onChange={(e) => updateSettings({ delaySightings: e.target.checked })} />
          </label>
          <div className="set-row column">
            <span className="muted small">Always on: photos have their hidden GPS data removed, so the only location saved is the one shown on the snap.</span>
          </div>
        </div>

        <div className="set-group">
          <div className="set-row column">
            <span><strong>Username</strong><span className="muted small">{account ? 'Shown to other spotters. Never use your password or email here.' : 'Shown on your snaps.'}</span></span>
            <div className="name-edit">
              <input id="displayName" name="cat-snap-display-name" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                data-lpignore="true" data-1p-ignore="true" data-form-type="other"
                value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } }} />
              <button className="pill-btn dark" disabled={name.trim().toLowerCase() === settings.username} onClick={saveName}>Save</button>
            </div>
          </div>
          <label className="set-row">
            <span><strong>Show the example cat</strong><span className="muted small">Not-Claude, the built-in starter cat. Never uploaded.</span></span>
            <input type="checkbox" className="switch" checked={settings.showExample} onChange={(e) => updateSettings({ showExample: e.target.checked })} />
          </label>
          <label className="set-row">
            <span><strong>Plus (mock)</strong><span className="muted small">Try the paid tier. No payment.</span></span>
            <input type="checkbox" className="switch" checked={settings.plus} onChange={(e) => updateSettings({ plus: e.target.checked })} />
          </label>
        </div>

        <div className="set-group">
          <div className="set-row column">
            <span><strong>Location</strong>{geo.source && <span className="muted small">Last fix from {geo.source === 'fused' ? 'Google location' : geo.source === 'gps' ? 'satellite GPS' : geo.source === 'network' ? 'Wi-Fi / mobile network' : geo.source}{geo.updatedAt ? `, ${timeAgo(geo.updatedAt)}` : ''}</span>}</span>
            <LocationHelp compact />
            <button className="pill-btn" style={{ justifySelf: 'start', marginTop: 6 }} onClick={() => locationDiagnostics().then(setDiagText)}>Show location diagnostics</button>
            {diagText && <pre className="diag">{diagText}</pre>}
          </div>
          <div className="set-row">
            <span><strong>On this phone</strong><span className="muted small">
              {mine} snap{mine === 1 ? '' : 's'}{usage ? ` · ${usage}` : ''}{account ? ' · also backed up to your account' : persisted ? '' : ' · back up regularly'}
            </span></span>
          </div>
        </div>

        <div className="set-group">
          <p className="set-title"><Icon name="download" /> Backup file</p>
          <p className="muted small">A file with all your snaps and photos, for keeping your own copy or moving without an account.</p>
          <div className="set-actions">
            <button className="pill-btn dark" onClick={() => exportData().then((how) => toast(how === 'shared' ? 'Backup ready. Pick where to save it.' : 'Backup saved to your downloads')).catch(() => toast('Backup failed. Try again.'))}><Icon name="download" />Save backup</button>
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
            {!isNative() && <li>Add Cat Snap to your home screen so it opens full screen and works offline.</li>}
            <li>No signal? Snap anyway. Everything saves on the phone and uploads when you're back online.</li>
            <li>Use "Saw them again" on a cat that's already snapped instead of making a duplicate.</li>
          </ul>
        </div>

        <button className={`ghost-btn ${armed ? 'armed' : ''}`} onClick={async () => {
          if (!armed) { setArmed(true); window.setTimeout(() => setArmed(false), 4000); return; }
          setArmed(false);
          await resetAll();
          toast('All Cat Snap data on this phone was deleted');
        }}>{armed ? 'Tap again to delete everything stored on this phone' : 'Delete all data on this phone'}</button>
        <p className="version mono">Cat Snap field test · v{__APP_VERSION__}</p>
      </div>
    </section>
  );
}

function AccountPanel() {
  const { account, sync, syncNow, signUp, signIn, signOut, deleteAccount, toast, settings, changePassword } = useStore();
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  if (account) {
    const status = sync.state === 'syncing' ? 'Syncing…'
      : sync.state === 'offline' ? `Offline. ${sync.pending} change${sync.pending === 1 ? '' : 's'} will upload when you're back online.`
      : sync.state === 'error' ? (sync.message ?? 'Sync had a problem. It will retry.')
      : sync.lastSync ? `Synced ${timeAgo(sync.lastSync)}${sync.pending ? ` · ${sync.pending} waiting` : ''}` : 'Ready to sync';
    return (
      <div className="set-group">
        <p className="set-title"><Icon name="globe" /> Account</p>
        <div className="set-row">
          <span><strong>@{settings.username}</strong><span className="muted small">{account.email}</span></span>
          <button className="pill-btn" onClick={() => signOut().then(() => toast('Signed out. Your snaps stay on this phone.'))}>Sign out</button>
        </div>
        <div className="set-row">
          <span><strong>Cloud sync</strong><span className={`muted small ${sync.state === 'error' ? 'warn' : ''}`}>{status}</span></span>
          <button className="pill-btn" disabled={sync.state === 'syncing'} onClick={syncNow}>Sync now</button>
        </div>
        <form className="set-row column" onSubmit={async (e) => {
          e.preventDefault();
          if (newPw.length < 10) { toast('Use a password of at least 10 characters.'); return; }
          if (newPw !== newPw2) { toast("The two passwords don't match."); return; }
          if (newPw.toLowerCase() === settings.username) { toast("Don't use your username as your password."); return; }
          try { await changePassword(newPw); setNewPw(''); setNewPw2(''); toast('Password changed'); }
          catch (err) { toast(err instanceof Error ? err.message : "Couldn't change the password."); }
        }}>
          <span><strong>Change password</strong></span>
          <input type="email" autoComplete="username" value={account.email ?? ''} readOnly hidden />
          <input id="newPassword" type="password" autoComplete="new-password" minLength={10} placeholder="New password (10+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <input id="newPassword2" type="password" autoComplete="new-password" minLength={10} placeholder="Repeat new password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
          <button type="submit" className="pill-btn dark" style={{ justifySelf: 'start' }} disabled={!newPw || !newPw2}>Change password</button>
        </form>
        <div className="set-row column">
          <button className={`ghost-btn left ${armed ? 'armed' : ''}`} disabled={busy} onClick={async () => {
            if (!armed) { setArmed(true); window.setTimeout(() => setArmed(false), 5000); return; }
            setBusy(true);
            try { await deleteAccount(); toast('Account deleted. Your snaps remain only on this phone.'); }
            catch (e) { toast(e instanceof Error ? e.message : 'Delete failed.'); }
            finally { setBusy(false); setArmed(false); }
          }}>{busy ? 'Deleting…' : armed ? 'Tap again: permanently delete my account, snaps and photos from the server' : 'Delete my account'}</button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (password.length < 10) { toast('Use a password of at least 10 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') {
        const r = await signUp(email.trim(), password);
        if (r === 'confirm-email') {
          setNotice(`Check ${email.trim()} for a confirmation email and tap the link. The page it opens may look broken; that's fine. Then come back and sign in.`);
          setMode('in');
        } else toast('Account created. Syncing your snaps…');
      } else {
        await signIn(email.trim(), password);
        toast('Signed in. Syncing your snaps…');
      }
      setPassword('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That didn’t work. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="set-group">
      <p className="set-title"><Icon name="globe" /> Account</p>
      <p className="muted small">Sign in to back up your snaps and see cats shared by other spotters. Without an account, everything stays on this phone.</p>
      <div className="seg auth-tabs">
        <button className={mode === 'up' ? 'active' : ''} onClick={() => setMode('up')}>Create account</button>
        <button className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>Sign in</button>
      </div>
      {notice && <p className="notice">{notice}</p>}
      <form className="auth-form" onSubmit={submit}>
        <input id="authEmail" type="email" autoComplete="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input id="authPassword" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={10}
          placeholder={mode === 'up' ? 'Password (10+ characters)' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="muted small">Your email is only used to sign in and is never shown to other spotters. You'll get a random username, which you can change after signing in.</p>
    </div>
  );
}

function NotificationsPanel() {
  const { settings, setNotifications, toast } = useStore();
  const n = settings.notify;
  const set = (patch: Partial<typeof n>) => setNotifications(patch).then((on) => {
    if (patch.enabled && !on) toast(isNative() ? 'Allow notifications for Cat Snap in your phone settings to turn them on.' : 'Phone notifications work in the Android app.');
  });
  const kinds: [keyof typeof n, string][] = [['like', 'Likes on your cats'], ['comment', 'Comments on your cats'], ['sighting', 'Someone spots your cat again'], ['nearby', 'New cats near you']];
  return (
    <div className="set-group">
      <p className="set-title"><Icon name="bell" /> Notifications</p>
      <label className="set-row">
        <span><strong>Phone notifications</strong><span className="muted small">{isNative() ? 'Checks about every 15 minutes, even when the app is closed. Works without Google services.' : 'Available in the Android app. Activity still shows under the bell.'}</span></span>
        <input type="checkbox" className="switch" checked={n.enabled} disabled={!isNative()} onChange={(e) => set({ enabled: e.target.checked })} />
      </label>
      {kinds.map(([k, label]) => (
        <label className="set-row" key={k}>
          <span><strong>{label}</strong></span>
          <input type="checkbox" className="switch" checked={!!n[k]} onChange={(e) => set({ [k]: e.target.checked })} />
        </label>
      ))}
      <div className="set-row">
        <span><strong>"Near you" distance</strong><span className="muted small">Worked out on your phone; your location isn't sent.</span></span>
        <div className="seg">
          {[1, 3, 10].map((km) => <button key={km} className={n.nearbyKm === km ? 'active' : ''} onClick={() => set({ nearbyKm: km })}>{km} km</button>)}
        </div>
      </div>
    </div>
  );
}
