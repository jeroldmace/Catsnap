import { useEffect } from 'react';
import { timeAgo } from '../../core/geo';
import { isNative } from '../../data/platform';
import { useStore } from '../store';
import { Icon } from '../components/Icon';

const ICON = { like: 'heart', comment: 'comment', sighting: 'eye', nearby: 'pin' } as const;

export function Activity({ onOpen, onSettings }: { onOpen: (id: string) => void; onSettings: () => void }) {
  const { activity, unread, markActivityRead, account, settings, setNotifications, toast, syncNow } = useStore();

  // Viewing the list marks everything as read (after a moment, so new items still stand out).
  useEffect(() => {
    if (!unread) return;
    const t = window.setTimeout(() => { markActivityRead(); }, 2500);
    return () => window.clearTimeout(t);
  }, [unread, markActivityRead]);

  return (
    <section className="view" aria-label="Activity">
      <div className="form-head">
        <div><p className="eyebrow">Notifications</p><h1>Activity</h1></div>
        <button className="pill-btn" onClick={() => syncNow()}><Icon name="radar" />Refresh</button>
      </div>

      {!account && <p className="empty">Sign in to get notified about likes, comments and sightings on your cats.</p>}

      {account && isNative() && !settings.notify.enabled && (
        <div className="notify-cta">
          <Icon name="bell" />
          <span><strong>Get notified on your phone</strong><span className="muted small">Likes, comments and sightings on your cats, and new cats near you. Checks about every 15 minutes.</span></span>
          <button className="pill-btn dark" onClick={() => setNotifications({ enabled: true }).then((on) => toast(on ? 'Notifications on' : 'Allow notifications for Cat Snap in your phone settings to turn them on.'))}>Turn on</button>
        </div>
      )}

      <ul className="activity-list">
        {account && activity.length === 0 && <li className="empty">Nothing yet. When someone likes, comments on or spots your cats, or a cat is posted near you, it shows up here.</li>}
        {activity.map((a) => (
          <li key={a.id} className={a.read ? '' : 'unread'} onClick={() => onOpen(a.snapId)}>
            <span className={`act-icon ${a.kind}`}><Icon name={ICON[a.kind]} /></span>
            <span className="grow"><span>{a.text}</span><span className="muted small">{timeAgo(a.at)}</span></span>
            {!a.read && <i className="unread-dot" aria-label="New" />}
          </li>
        ))}
      </ul>
      {account && <button className="ghost-btn" onClick={onSettings}>Notification settings</button>}
    </section>
  );
}
