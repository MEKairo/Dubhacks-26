# DubHacks shared availability backend (MVP)

## Already added
The SQL migration `supabase/migrations/20261017_social_calendar.sql` creates:
- `friendships`: pending/accepted/rejected friend requests, no duplicate pairs
- `groups` and `group_members`: one row per group, not a physical table per group
- `busy_slots`: **start/end timestamps only**, never event titles or descriptions
- Row-level security: signed-in users see busy slots only for themselves, accepted friends, or shared-group members
- RPCs: `send_friend_request`, `respond_friend_request`, `create_group`, `add_group_member`, `remove_group_member`

The pre-existing `profiles` schema and signup trigger must be installed **first**. Do not rerun that original SQL if it has already been applied. Run the new migration once in Supabase SQL Editor. For production, use Supabase CLI migrations to track applied changes.

## Frontend setup (Emily's React/Vite app)
Run `npm install @supabase/supabase-js` in the React app. Add `.env.local` (gitignored):
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```
Create `src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
```
These VITE_ variable names assume Vite; adapt for other React tooling.

## Google sign-in
Configure Google as a provider in Supabase Dashboard → Authentication → Providers and configure the OAuth callback/redirect URLs for your frontend and Supabase project.
```js
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin }
});
```
Google login does **not** automatically guarantee persistent calendar access. Calendar linking is a separate consent flow.

## React calls after sign-in
```js
// Find profiles by username
const { data: people, error: searchError } = await supabase
  .from('profiles').select('id, username, display_name, avatar_url')
  .ilike('username', '%alex%').limit(20);

// Send friend request
const { data: requestId, error: requestError } =
  await supabase.rpc('send_friend_request', { target_username: 'alex' });

// Accept request (must be recipient)
const { error: acceptError } = await supabase.rpc('respond_friend_request', {
  request_id: 'REQUEST_UUID', accept_request: true
});

// Create group
const { data: groupId, error: groupError } =
  await supabase.rpc('create_group', { group_name: 'Hackathon crew' });

// Add accepted friend to group (owner only)
const { error: memberError } = await supabase.rpc('add_group_member', {
  target_group: groupId, target_user: 'FRIEND_UUID'
});

// Fetch availability for a friend in a visible time range
const { data: busy, error: busyError } = await supabase
  .from('busy_slots').select('user_id, starts_at, ends_at')
  .eq('user_id', 'FRIEND_UUID')
  .lt('starts_at', rangeEndISO).gt('ends_at', rangeStartISO);
```

## IMPORTANT: Google Calendar integration is not implemented yet
Build a Supabase Edge Function (or secure backend) for linking and syncing calendars:
1. Start Google OAuth consent for the minimum needed calendar **free/busy** scope, separate from login. Google OAuth consent screen, scopes, test users and redirect URIs must be configured.
2. Handle the authorization code server-side and store refresh tokens encrypted in server-only storage; **never** expose refresh tokens or service-role keys to React or `profiles`.
3. Query Google's free/busy endpoint server-side for a bounded date range. Only write busy intervals to `busy_slots` using a server-only service-role client. Never store or return titles, descriptions, locations, attendees, or raw event payloads.
4. Sync periodically and on reconnect, replace stale intervals transactionally, and handle revoked access and sync failures. Consider storing last-synced timestamps and displaying stale-sync warnings.
5. Add a disconnect endpoint that revokes tokens where possible, deletes credentials and cached busy slots. Set a bounded retention window.
6. For stricter privacy, consider sharing only aggregate busy/free state rather than precise intervals, and add a per-user sharing toggle. The current policy shares precise busy intervals with all accepted friends and shared group members.
7. Do not request `calendar.events` read scopes if the free/busy endpoint meets requirements. Confirm Google scope verification requirements before launch.

## Before launch
- Add case-insensitive unique username enforcement and input length validation.
- Add abuse controls: rate-limit username search and friend requests; allow blocking users, canceling requests and removing friends.
- Add group invitation/acceptance flow (current owner can add accepted friends directly).
- Decide whether to expose `busy_slots` to friends directly or via an aggregation endpoint; verify with two real test accounts that RLS blocks strangers.
- Test database migrations on a fresh project, and review the security-definer functions before production.
- Store SQL migrations in Git; never commit `.env.local` or credentials.
