import { createClient } from 'npm:@supabase/supabase-js@2';
import { CalendarError, fetchOwnedBusy, verifyOwnedCalendar } from '../_shared/calendar.mjs';

Deno.serve(async (req: Request) => {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map(s => s.trim().replace(/\/+$/, ''));
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.includes(origin)) return reply({ error: 'Origin is not allowed.' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return reply({ error: 'Sign in first.' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await client.auth.getUser(auth.slice(7));
    if (error || !user) return reply({ error: 'Your session expired. Sign in again.' }, 401);
    let body;
    try { body = await req.json(); } catch { return reply({ error: 'Send a JSON request body.' }, 400); }
    if (!body || typeof body !== 'object') return reply({ error: 'Send a JSON object.' }, 400);
    const { googleAccessToken, timeMin, timeMax, action, calendarId, calendarIds } = body;
    // This endpoint returns only data authorized by the supplied Google token.
    // It accepts no friend IDs and writes no tokens or calendar data to the database.
    if (action === 'link') return reply({ calendar: await verifyOwnedCalendar(googleAccessToken, calendarId) });
    if (action !== undefined) return reply({ error: 'Unknown calendar action.' }, 400);
    return reply(await fetchOwnedBusy(googleAccessToken, timeMin, timeMax, calendarIds === undefined ? ['primary'] : calendarIds));
  } catch (error) {
    if (error instanceof CalendarError) return reply({ error: error.message }, error.status);
    return reply({ error: 'Calendar request failed. Try again shortly.' }, 502);
  }
});
