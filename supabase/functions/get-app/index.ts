// Invite-only download of the Cat Snap Android app.
// GET /functions/v1/get-app?code=<personal invite code>
// Valid code -> redirect to a 10-minute signed download link for the latest APK.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

function adminKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) { try { const k = JSON.parse(keys)['default']; if (k) return k; } catch { /* fall back */ } }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'GET') return text('Method not allowed', 405);
  const params = new URL(req.url).searchParams;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });

  // ?info=1 -> latest version number, for the app's "update available" check.
  if (params.get('info')) {
    const { data } = await admin.storage.from('app-releases').download('latest.json');
    if (!data) return json({ version: null });
    try { const m = JSON.parse(await data.text()); return json({ version: m.version, size: m.size }); } catch { return json({ version: null }); }
  }

  // Signed-in app users can update without an invite code: ?json=1 with their access token.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (params.get('json') && bearer) {
    const { data: u } = await admin.auth.getUser(bearer);
    if (!u?.user) return json({ error: 'Not signed in' }, 401);
    const { data: signed } = await admin.storage.from('app-releases').createSignedUrl('catsnap-latest.apk', 600, { download: 'catsnap.apk' });
    if (!signed) return json({ error: 'Not available' }, 503);
    return json({ url: signed.signedUrl });
  }

  const code = (params.get('code') ?? '').toLowerCase();
  if (!/^[a-z0-9]{8,32}$/.test(code)) return text('This download link is missing its invite code. Ask the person who invited you for a new link.', 403);

  const { data: inv } = await admin.from('app_invites').select('code, revoked, expires_at, max_uses, uses').eq('code', code).maybeSingle();
  const now = new Date();
  if (!inv || inv.revoked || (inv.expires_at && new Date(inv.expires_at) < now) || (inv.max_uses != null && inv.uses >= inv.max_uses)) {
    return text('This invite link is no longer valid. Ask the person who invited you for a new one.', 403);
  }

  const { data: signed, error } = await admin.storage.from('app-releases')
    .createSignedUrl('catsnap-latest.apk', 600, { download: 'catsnap.apk' });
  if (error || !signed) return text('The app file is not available right now. Try again later.', 503);

  await admin.from('app_invites').update({ uses: inv.uses + 1, last_used_at: now.toISOString() }).eq('code', code);
  return new Response(null, { status: 302, headers: { Location: signed.signedUrl, 'Cache-Control': 'no-store' } });
});
