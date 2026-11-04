// Deletes the calling user's account and everything they created.
// The caller is identified from their own access token; the admin key is only
// used server-side, after that check, and only on the caller's own data.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function adminKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try { const k = JSON.parse(keys)['default']; if (k) return k; } catch { /* fall back */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is calling? (validates the user's JWT with Supabase Auth)
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  // Remove the user's photos (their own folder only).
  const bucket = admin.storage.from('snap-photos');
  for (;;) {
    const { data: files, error } = await bucket.list(user.id, { limit: 1000 });
    if (error) return json({ error: 'Could not remove photos' }, 500);
    if (!files || files.length === 0) break;
    const { error: rmErr } = await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
    if (rmErr) return json({ error: 'Could not remove photos' }, 500);
    if (files.length < 1000) break;
  }

  // Deleting the auth user cascades to profile -> snaps, sightings, likes, comments.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: 'Could not delete account' }, 500);

  return json({ deleted: true });
});
