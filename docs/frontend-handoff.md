# Frontend integration handoff

Local working branch: `integration`, created from `origin/integrate-emily-backend`.
The integration branch already contains Emily's frontend commit `ef6f7f6`.
The root README edit was preserved. No database changes or hosting deployment were made.

## Account flow

- The application waits for Supabase session restoration before showing private pages.
- Signed-out deep links return to the welcome screen. There is no Explore/demo bypass.
- Signup with a returned session opens profile setup; completing setup saves supported fields and opens the calendar.
- If confirmation is required, signup stays on authentication and asks the user to confirm their email, then log in.
- Login opens the calendar. Reloading restores the session.
- Sign out affects this browser's session and closes access to private routes.
- Signed-in screens use backend people, groups, notes, and availability; failures do not fall back to sample people.

## Local configuration

`frontend/.env.local` is ignored by Git and contains only the public project URL and publishable key found in the JavaScript served by `https://realmoment.work`.
It is not part of a commit. Other machines and hosting builds must set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` themselves.
Never place service-role keys, database passwords, or Google client secrets in Vite variables.

Read-only project checks confirmed that email and Google providers are enabled and the expected profile, activity-note, and busy-sync-coverage columns are exposed. No user records were requested (`limit=0`), and no test accounts or live database mutations were made.

## Local verification

From `frontend/`:

```sh
npm install
npm test
npm run test:browser
npm run build
npm run dev
```

Use `npm.cmd` on Windows if PowerShell blocks npm scripts.
Browser tests use installed Chrome and an isolated fake Supabase project with intercepted requests. They do not use the live project's credentials.

The real-account check still needs to be done by the team: sign in with two accounts, connect Google, check friend/group comparisons, save a profile/note, and confirm that strangers cannot read availability.

Google linking must allow the actual frontend redirect URL in Supabase Auth. The Edge Function also needs the actual frontend origin allowed. Local OAuth uses the current page directory so Live Server's nested `/frontend/dist/` path can return correctly if allowlisted. Published root hosting returns to `/`.

## Remaining backend boundaries

- Work-group mode and hour/weekend sharing policies have no contract in this branch; work-group creation remains blocked rather than saving a social group accidentally.
- Company directory and canceling outgoing friend requests are not implemented by the backend contract.
- Theme and group colors remain session-only appearance settings.
- Google availability is unknown outside successfully synced coverage. Missing busy rows are not assumed to mean free time.
- Persistent/background Google refresh, disconnect/revocation, and all server-side sharing policies remain backend responsibilities.

The existing `docs/integration-status.md` describes the earlier branch snapshot; this document records the subsequent authentication-flow cleanup.
