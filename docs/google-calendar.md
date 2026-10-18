# Google Calendar integration

## What works locally

The React screen connects Google, accepts Google Calendar browser/share URLs or Calendar
IDs, verifies owner access server-side, and lets the user enable/remove linked calendars.
Queries combine selected calendars' busy intervals, merging duplicates, overlaps, and
adjacent blocks. If any selected calendar cannot be read, the entire query fails rather
than incorrectly marking the user as free.

Google Calendar's owner access role is the eligibility rule. It establishes management
access, not historical proof of who originally created the calendar.
No event details or calendar write permissions are requested.

Calendar selections are saved in browser localStorage keyed by Supabase user ID.
This is a temporary frontend adapter, not database/profile persistence or cross-device sync.
Google tokens are never included in that selection storage.

## Required project setup

1. Enable Google Calendar API in Google Cloud.
2. Google Auth Platform > Data Access must include:
   - https://www.googleapis.com/auth/calendar.freebusy
   - https://www.googleapis.com/auth/calendar.calendarlist.readonly
   Standard openid/email/profile permissions are also needed for Supabase Google login.
3. Keep the OAuth app in Testing and add each tester under Audience.
4. Enable Google sign-in in Supabase; enter the Google client ID/secret there.
   Add the callback URL displayed by Supabase to the Google Web Client redirect URIs.
5. Allow the React URL in Supabase Authentication > URL Configuration.
   Current local URL: http://127.0.0.1:5173/
6. Copy frontend/.env.example to frontend/.env.local and set the Supabase URL and publishable
   key. Legacy VITE_SUPABASE_ANON_KEY is also accepted. Never use secret/service-role keys
   or Google client secrets in VITE_ settings. Restart Vite after environment changes.
7. Redeploy google-freebusy from the updated gcal-sync code, including _shared/calendar.mjs:
   npx supabase functions deploy google-freebusy --project-ref YOUR_PROJECT_REF
8. Set ALLOWED_ORIGINS to the frontend origin, with no trailing slash:
   npx supabase secrets set ALLOWED_ORIGINS=http://127.0.0.1:5173 --project-ref YOUR_PROJECT_REF
   Multiple origins can be comma separated. The handler normalizes trailing slashes.
9. Reconnect Google Calendar and approve calendar-list and free/busy permissions.
   Old provider tokens do not automatically gain newly requested scopes.

The handler authenticates every request via Supabase auth.getUser. Gateway JWT
verification must match your project's signing-key configuration; do not remove the
handler's user verification. No database migrations are needed for this function.

## Browser link input

Supported: Calendar ID, calendar.google.com/calendar/... with src=<calendar ID>,
and browser share links with cid=<base64 calendar ID>. www.google.com/calendar links
are also accepted. URLs are parsed locally; the backend calls only Google's fixed API
endpoints, never an arbitrary supplied URL.
Secret/private iCal feeds, .ics URLs, and event links are rejected.
Get a calendar's ID or share link from Google Calendar Settings > Settings for my calendars.

## Backend API

All requests are POST /functions/v1/google-freebusy, with the signed-in Supabase session
bearer token and the project's public key. Google access tokens must not be logged.

Link/verify request:
{ action: "link", googleAccessToken, calendarId }

Response:
{ calendar: { id, name, primary, timeZone } }

Busy request:
{ googleAccessToken, timeMin, timeMax, calendarIds: ["primary", "ID@group.calendar.google.com"] }

Response:
{ timeMin, timeMax, calendarIds: ["canonical IDs"], busy: [{ start, end }] }

There must be 1–20 selected IDs and at most a 31-day range. Owner access is rechecked
for all IDs on each read. Only selected IDs are fetched. No IDs means primary for legacy
callers; an explicitly empty list is an error. Older deployed functions must be updated
before multi-calendar reads; the frontend checks for the new response shape.

## Contract for Alex/Harley

Database ownership stays with the backend team. Replace linkedCalendars.mjs's browser
storage adapter with backend-owned storage when ready.
Suggested linked-calendar fields: user_id, calendar_id, display_name, enabled.
Only owners of a profile should edit its settings. Verify Google owner access on the
server when linking, and revalidate on sync; never trust a browser's claim of ownership.
No Google credentials belong in public profiles or linked-calendar rows.

The Calendar function currently returns busy intervals without persisting busy_slots.
Background sync, encrypted refresh-token storage, and friends/group aggregation still
need backend integration. Empty/stale/missing synced data must not imply free time.

findSharedAvailability in _shared/calendar.mjs combines successfully fetched members'
busy intervals within explicit working windows. Membership/friendship authorization
must precede access to any other user's availability.

## Verification

node --test tests/calendar.test.mjs tests/calendar-dates.test.mjs tests/multiple-calendars.test.mjs
npm --prefix frontend run build

For a live test, link two owned calendars. Put overlapping Busy events on both. Check the
range: overlaps should appear as one block. Disable one calendar and query again to
confirm its unique blocks disappear. All toggles off must disable queries.
Moving a real event and querying again should change the result.
Live testing requires the redeployed function, new scopes, and Google consent.
