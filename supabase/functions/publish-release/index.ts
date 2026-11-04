// Upload a new Cat Snap APK to the private app-releases bucket.
// POST /functions/v1/publish-release?version=0.7.1  (body: APK bytes)
// Header x-publish-token must match; only its SHA-256 is stored here.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const TOKEN_SHA256 = 'f1fe51cacf2e6fcce3039a756c33b0f87df7d4b363da0e515aa1c94559d54cab';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function adminKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) { try { const k = JSON.parse(keys)['default']; if (k) return k; } catch { /* fall back */ } }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = req.headers.get('x-publish-token') ?? '';
  if (!token || !safeEqual(await sha256(token), TOKEN_SHA256)) return json({ error: 'Forbidden' }, 403);

  const version = new URL(req.url).searchParams.get('version') ?? '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) return json({ error: 'Bad version' }, 400);
  const bytes = new Uint8Array(await req.arrayBuffer());
  // APKs are zip files: must start with "PK".
  if (bytes.length < 1000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return json({ error: 'Not an APK' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = admin.storage.from('app-releases');
  const type = 'application/vnd.android.package-archive';
  for (const path of [`catsnap-${version}.apk`, 'catsnap-latest.apk']) {
    const { error } = await bucket.upload(path, bytes, { contentType: type, upsert: true });
    if (error) return json({ error: error.message }, 500);
  }
  const meta = JSON.stringify({ version, size: bytes.length, uploaded_at: new Date().toISOString() });
  await bucket.upload('latest.json', new Blob([meta], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
  return json({ ok: true, version, size: bytes.length });
});
