import { useState } from 'react';
import { startUpdate } from '../../data/appUpdate';
import { useStore } from '../store';
import { Icon } from './Icon';

/** "Version x is ready" with a one-tap install over the current app. */
export function UpdateBanner() {
  const { updateAvailable, toast } = useStore();
  const [busy, setBusy] = useState(false);
  if (!updateAvailable) return null;
  return (
    <div className="update-banner">
      <Icon name="download" />
      <span><strong>Cat Snap {updateAvailable} is ready</strong><span className="muted small">Installs over this version. Your snaps stay.</span></span>
      <button className="pill-btn dark" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await startUpdate(); toast('Downloading. Open the file when it finishes, then tap Install / Update.'); }
        catch (e) { toast(e instanceof Error ? e.message : 'Update failed.'); }
        finally { setBusy(false); }
      }}>{busy ? '…' : 'Update'}</button>
    </div>
  );
}
