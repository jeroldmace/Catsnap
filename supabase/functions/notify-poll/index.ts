// Background notification check for the Cat Snap Android app.
// POST { cursor?: number, since?: string }  with header x-device-key
// Returns new notifications for the device's owner, plus recently shared snaps
// (the phone checks distance itself, so no location is ever sent here).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function adminKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) { try { const k = JSON.parse(keys)['default']; if (k) return k; } catch { /* fall back */ } }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const key = req.headers.get('x-device-key') ?? '';
  if (key.length < 32) return json({ error: 'Forbidden' }, 403);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: dev } = await admin.from('notification_devices').select('id, user_id').eq('token_hash', await sha256(key)).maybeSingle();
  if (!dev) return json({ error: 'Forbidden' }, 403);
  await admin.from('notification_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', dev.id);

  let body: { cursor?: number; since?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const now = new Date();
  const cursor = Number.isFinite(body.cursor) ? Number(body.cursor) : 0;
  const since = body.since && !Number.isNaN(Date.parse(body.since)) ? new Date(body.since) : new Date(now.getTime() - 60 * 60 * 1000);

  // Owner's notifications (same rules as the app: visible_at reached, unread).
  const { data: notes } = await admin.from('notifications')
    .select('id, kind, created_at, snap_id, snaps(name), profiles!notifications_actor_id_fkey(username)')
    .eq('user_id', dev.user_id).is('read_at', null).lte('visible_at', now.toISOString()).gt('id', cursor)
    .order('id', { ascending: true }).limit(20);

  // Snaps by others that became visible to everyone since the last check.
  // A delayed snap becomes visible one hour after it was shared.
  const HOUR = 60 * 60 * 1000;
  const { data: snaps } = await admin.from('snaps')
    .select('id, name, habitat, lat, lng, visibility, shared_at')
    .neq('owner_id', dev.user_id).neq('visibility', 'private')
    .gt('shared_at', new Date(since.getTime() - HOUR).toISOString())
    .order('shared_at', { ascending: true }).limit(200);
  const nearby = (snaps ?? [])
    .map((s) => ({ ...s, visible_from: new Date(Date.parse(s.shared_at) + (s.visibility === 'delayed' ? HOUR : 0)) }))
    .filter((s) => s.visible_from > since && s.visible_from <= now)
    .slice(0, 100)
    .map(({ id, name, habitat, lat, lng, visible_from }) => ({ id, name, habitat, lat, lng, visible_from: visible_from.toISOString() }));

  return json({
    now: now.toISOString(),
    notifications: (notes ?? []).map((n: Record<string, any>) => ({
      id: n.id, kind: n.kind, created_at: n.created_at, snap_id: n.snap_id,
      snap_name: n.snaps?.name ?? 'your cat', actor: n.profiles?.username ?? 'Someone',
    })),
    nearby,
  });
});
