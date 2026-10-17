# Google Calendar integration

This branch includes Emily's React + Vite scaffold, a Google sign-in/Calendar consent button,
an authenticated Supabase Edge Function that reads the caller's Google primary calendar busy
intervals, and a tested shared-availability utility. No event creation or event details are requested.

## Configure once Supabase exists

1. Create the Supabase project. Enable Google in Authentication > Sign In / Providers.
2. Enter the Google Web Client ID and secret there, never in React.
3. Copy the callback URL shown by Supabase (typically https://PROJECT.supabase.co/auth/v1/callback)
   into Google Auth Platform > Clients > Dubhacks Web Client > Authorized redirect URIs.
   Use the displayed Supabase URL, not a guessed localhost callback.
4. In Supabase Authentication > URL Configuration, set Site URL to http://localhost:5173 for
   development and allow that redirect URL. Add production URLs when deploying.
5. Keep Google Audience in Testing and add each tester. Keep calendar.freebusy in Data Access.
   Supabase's Google provider also needs the standard openid, email, and profile permissions.
6. Copy frontend/.env.example to frontend/.env.local and fill in the project URL and public
   anon key from Supabase. Never put the Google secret or Supabase service role key in VITE_ variables.
7. Deploy the function using Supabase CLI after login/link:
   supabase functions deploy google-freebusy
   The function validates the user's bearer token using auth.getUser; keep gateway JWT verification
   enabled for legacy JWT keys. If your project uses newer signing keys that the gateway does not
   support, disable gateway verification only after confirming the handler's getUser validation.
8. Set ALLOWED_ORIGINS as an Edge Function secret to your frontend origin.
   Default: http://localhost:5173. Multiple origins may be comma separated.
9. Run npm install and npm run dev inside frontend. Connect Google Calendar, then click
   Check my next 7 days. Confirm busy blocks match a known event in the primary calendar.

## Contract for frontend/backend teammates

POST /functions/v1/google-freebusy with the Supabase session bearer token and JSON:
{ "googleAccessToken": "<session.provider_token>", "timeMin": "<RFC3339>", "timeMax": "<RFC3339>" }

Returns { timeMin, timeMax, busy: [{ start, end }] }. Maximum query range: 31 days.
Google tokens must not be logged. Busy data is returned only to the requesting browser and
is not persisted. Missing calendar data is an error, never silently interpreted as free time.

findSharedAvailability(busyByMember, windows, minimumMinutes) in
supabase/functions/_shared/calendar.mjs merges members' busy intervals and returns free
intervals within explicit non-overlapping working windows. All selected members must have
successfully fetched data. Build windows with timezone-aware dates; do not assume UTC
working hours match the user's timezone.

## Current boundaries

This is an interactive primary-calendar integration, not background sync. Google provider
access tokens expire independently of Supabase sessions. Reconnect when prompted.
Refresh tokens are not requested or stored. Later, a backend-owned connection flow and
private encrypted token storage can support syncing while friends are offline.
Do not put Google refresh tokens into a public profiles table.

Friend/group authorization and persisted availability are intentionally left for the team's
backend schema. A group endpoint must verify the caller's membership or friendship before
reading anyone else's availability. This endpoint accepts no friend IDs.
Only the primary calendar is included; multi-calendar selection needs a separate design
and potentially additional permissions.

## Verification

From repository root: node --test tests/calendar.test.mjs
From frontend: npm run build

Tests cover overlapping busy blocks, working-hour clipping, minimum meeting duration,
missing member data, invalid query windows, provider failures, and the Google API contract.
Live OAuth and Edge Function deployment require the team's Supabase project and Google credentials.
