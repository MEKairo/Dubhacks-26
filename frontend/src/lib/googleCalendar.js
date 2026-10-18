import { supabase } from './supabase.js';
export { supabase };

export async function connectGoogleCalendar() {
  if (!supabase) throw new Error('Add your Supabase settings to frontend/.env.local first.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const request = {
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      redirectTo: window.location.origin,
      queryParams: { prompt: 'consent' },
    },
  };
  const needsLink = session && !session.user.identities?.some(identity => identity.provider === 'google');
  const { error } = needsLink
    ? await supabase.auth.linkIdentity(request)
    : await supabase.auth.signInWithOAuth(request);
  if (error) throw error;
}

async function callCalendar(body) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.provider_token) throw new Error('Reconnect Google Calendar to grant calendar access.');
  const { data, error } = await supabase.functions.invoke('google-freebusy', {
    body: { ...body, googleAccessToken: session.provider_token },
  });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.error || error.message);
  }
  return data;
}

export function linkOwnedCalendar(calendarId) {
  return callCalendar({ action: 'link', calendarId });
}

export async function getMyBusyTimes(timeMin, timeMax, calendarIds = ['primary']) {
  const result = await callCalendar({ timeMin, timeMax, calendarIds });
  if (!Array.isArray(result?.calendarIds) || !Array.isArray(result?.busy)) {
    throw new Error('The Calendar backend needs updating before selected calendars can be checked.');
  }
  return result;
}
