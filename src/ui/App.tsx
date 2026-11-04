import { useCallback, useEffect, useState } from 'react';
import { TIERS } from '../core/rules';
import { useStore } from './store';
import { CatSheet } from './components/CatSheet';
import { Icon, Paw } from './components/Icon';
import { Welcome } from './components/Welcome';
import { Catdex } from './screens/Catdex';
import { Feed } from './screens/Feed';
import { Plus } from './screens/Plus';
import { Radar, type RadarFilters } from './screens/Radar';
import { Settings } from './screens/Settings';
import { SnapForm } from './screens/SnapForm';

type View = 'feed' | 'radar' | 'snap' | 'dex' | 'plus' | 'settings';
const VIEWS: View[] = ['feed', 'radar', 'snap', 'dex', 'plus', 'settings'];
const readHash = (): View => {
  const h = location.hash.replace('#', '') as View;
  return VIEWS.includes(h) ? h : 'feed';
};

export function App() {
  const store = useStore();
  const { ready, settings, toastMsg, toast, snaps, account, sync } = store;
  const syncDot = !account ? 'none' : sync.state === 'error' ? 'bad' : sync.state === 'offline' || sync.pending > 0 ? 'wait' : 'ok';
  const syncLabel = sync.state === 'error' ? 'sync problem' : sync.state === 'offline' ? 'offline' : sync.pending > 0 ? `${sync.pending} waiting to sync` : 'synced';
  const [view, setView] = useState<View>(readHash);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [filters, setFilters] = useState<RadarFilters>({ radiusKm: 3, ageH: 24, minTier: 0, focusId: null });

  // Views live in the URL hash so the phone's back button works.
  useEffect(() => {
    const onHash = () => { setView(readHash()); setOpenId(null); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((v: View) => {
    if (v !== 'snap') setEditId(null);
    if (location.hash !== `#${v}`) location.hash = v; else setView(v);
    setOpenId(null);
    window.scrollTo(0, 0);
  }, []);

  // Drop Plus-only radar settings when switching back to Free.
  useEffect(() => {
    if (settings.plus) return;
    const t = TIERS.free;
    setFilters((f) => ({
      ...f,
      radiusKm: (t.radiusKm as readonly number[]).includes(f.radiusKm) ? f.radiusKm : 3,
      ageH: (t.ageH as readonly number[]).includes(f.ageH) ? f.ageH : 24,
      minTier: 0,
    }));
  }, [settings.plus]);

  const openPlus = useCallback((feature?: string) => { go('plus'); if (feature) toast(`${feature} is part of Plus`); }, [go, toast]);

  const showOnRadar = useCallback((id: string) => {
    const s = snaps.find((x) => x.id === id);
    if (!s) return;
    const tier = settings.plus ? TIERS.plus : TIERS.free;
    const ageH = (Date.now() - s.lastSeen) / 3600000;
    const radiusKm = tier.radiusKm.find((r) => r >= s.distanceKm) ?? tier.radiusKm[tier.radiusKm.length - 1];
    const maxAge = tier.ageH.find((h) => h >= ageH) ?? tier.ageH[tier.ageH.length - 1];
    setFilters({ radiusKm, ageH: maxAge, minTier: 0, focusId: id });
    go('radar');
    if (s.distanceKm > radiusKm || ageH > maxAge) toast(`${s.name} is outside the Free radar. Plus reaches 25 km and 30 days.`);
  }, [snaps, settings.plus, go, toast]);

  if (!ready) return <div className="boot"><span className="brand-mark"><Paw /></span></div>;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('feed')} aria-label="Cat Snap home">
          <span className="brand-mark"><Paw /></span>
          <span className="brand-name">Cat Snap</span>
        </button>
        <div className="topbar-right">
          <button className={`plus-chip ${settings.plus ? 'on' : ''}`} onClick={() => go('plus')}><Icon name="crown" />{settings.plus ? 'Plus' : 'Get Plus'}</button>
          <button className="account-btn" onClick={() => go('settings')} aria-label={account ? `Account and settings, ${syncLabel}` : 'Sign in, account and settings'}>
            <span className="account-avatar">{account ? settings.username.charAt(0).toUpperCase() : <Icon name="globe" />}<i className={`sync-dot ${syncDot}`} /></span>
            <span className="account-label">{account ? 'Account' : 'Sign in'}</span>
          </button>
        </div>
      </header>

      <main className="views">
        {view === 'feed' && <Feed onOpen={setOpenId} onPlus={openPlus} onSnap={() => go('snap')} />}
        {view === 'radar' && <Radar filters={filters} setFilters={setFilters} onOpen={setOpenId} onPlus={openPlus} />}
        {view === 'snap' && <SnapForm editId={editId} onDone={(id) => { setEditId(null); go('feed'); setTimeout(() => setOpenId(id), 50); }} onCancelEdit={() => { const id = editId; setEditId(null); go('dex'); if (id) setTimeout(() => setOpenId(id), 50); }} />}
        {view === 'dex' && <Catdex onOpen={setOpenId} onPlus={() => go('plus')} onSettings={() => go('settings')} onSnap={() => go('snap')} />}
        {view === 'plus' && <Plus onActivated={() => go('radar')} />}
        {view === 'settings' && <Settings onBack={() => go('dex')} />}
      </main>

      <nav className="tabbar" aria-label="Main">
        <button className={view === 'feed' ? 'active' : ''} onClick={() => go('feed')}><Icon name="home" />Feed</button>
        <button className={view === 'radar' ? 'active' : ''} onClick={() => go('radar')}><Icon name="radar" />Radar</button>
        <button className="snap-btn" aria-label="Snap a cat" onClick={() => { setEditId(null); go('snap'); }}><span><Icon name="camera" /></span></button>
        <button className={view === 'dex' || view === 'settings' ? 'active' : ''} onClick={() => go('dex')}><Icon name="book" />Catdex</button>
      </nav>

      <CatSheet id={openId} onClose={() => setOpenId(null)}
        onEdit={(id) => { setOpenId(null); setEditId(id); if (location.hash !== '#snap') location.hash = 'snap'; else setView('snap'); }}
        onShowOnRadar={(id) => { setOpenId(null); showOnRadar(id); }} />

      {!settings.onboarded && <Welcome />}
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}
