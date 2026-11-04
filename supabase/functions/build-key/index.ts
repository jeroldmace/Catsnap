// Release signing key for Cat Snap build sessions.
//   PUT  (header x-publish-token)  body: signing JSON -> stored in private bucket
//   POST (header x-build-secret)   -> returns the signing JSON
// x-build-secret must equal the CATSNAP_BUILD_SECRET function secret, which only
// the owner sets (in the Supabase dashboard and in the build environment).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const PUBLISH_TOKEN_SHA256 = 'f1fe51cacf2e6fcce3039a756c33b0f87df7d4b363da0e515aa1c94559d54cab';
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
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = admin.storage.from('build-secrets');

  if (req.method === 'PUT') {
    const token = req.headers.get('x-publish-token') ?? '';
    if (!token || !safeEqual(await sha256(token), PUBLISH_TOKEN_SHA256)) return json({ error: 'Forbidden' }, 403);
    const body = await req.text();
    let d: Record<string, unknown>;
    try { d = JSON.parse(body); } catch { return json({ error: 'Bad JSON' }, 400); }
    if (typeof d.keystore_b64 !== 'string' || typeof d.store_password !== 'string') return json({ error: 'Missing fields' }, 400);
    const { error } = await bucket.upload('signing.json', new Blob([body], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (req.method === 'POST') {
    const expected = Deno.env.get('CATSNAP_BUILD_SECRET') ?? '';
    const given = req.headers.get('x-build-secret') ?? '';
    if (expected.length < 20) return json({ error: 'Build secret not configured' }, 503);
    if (!given || !safeEqual(await sha256(given), await sha256(expected))) return json({ error: 'Forbidden' }, 403);
    const { data, error } = await bucket.download('signing.json');
    if (error || !data) return json({ error: 'Signing key not stored' }, 404);
    return new Response(await data.text(), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  return json({ error: 'Method not allowed' }, 405);
});
