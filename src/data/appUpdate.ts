import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { compareVersions } from '../core/version';
import { cloud } from './cloud';
import { isNative } from './platform';

const FN = `${SUPABASE_URL}/functions/v1/get-app`;

/** The newer app version available, or null if this one is current (Android app only). */
export async function checkForUpdate(): Promise<string | null> {
  if (!isNative() || !navigator.onLine) return null;
  try {
    const r = await fetch(`${FN}?info=1`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    const { version } = (await r.json()) as { version: string | null };
    return version && compareVersions(version, __APP_VERSION__) > 0 ? version : null;
  } catch { return null; }
}

/**
 * Download the new version. Android then shows its installer; because every
 * version is signed with the same key, it installs over this one and keeps your data.
 */
export async function startUpdate(): Promise<void> {
  const { data } = await cloud().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to update from inside the app, or open your invite link again.');
  const r = await fetch(`${FN}?json=1`, { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY } });
  const body = (await r.json()) as { url?: string; error?: string };
  if (!body.url) throw new Error("Couldn't get the update right now. Try again in a moment.");
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: body.url });
}
