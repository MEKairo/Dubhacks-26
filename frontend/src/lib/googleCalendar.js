import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function connectGoogleCalendar() {
  if (!supabase) throw new Error('Add your Supabase settings to frontend/.env.local first.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.freebusy',
      redirectTo: window.location.origin,
      queryParams: { prompt: 'consent' },
    },
  });
  if (error) throw error;
}

export async function getMyBusyTimes(timeMin, timeMax) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.provider_token) throw new Error('Reconnect Google Calendar to grant calendar access.');
  const { data, error } = await supabase.functions.invoke('google-freebusy', {
    body: { googleAccessToken: session.provider_token, timeMin, timeMax },
  });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.error || error.message);
  }
  return data;
}
