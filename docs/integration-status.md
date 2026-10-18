# Frontend/backend integration status

Integration branch: integrate-emily-backend.
Frontend source: emily-frontend at ef6f7f6.
Backend contract reviewed: alex-harley-backend at 0716b11.
Calendar client source: gcal-sync at d5c8b77.

No database SQL, RPCs, access policies, theme tokens, stylesheet, or logo were modified.
Emily's layouts/routes/controls remain. Status copy now distinguishes live reads,
unavailable data, backend failures, and session-only preview settings.

## Connected where both sides exist

| Existing UI | Existing backend | Integration |
| --- | --- | --- |
| Email signup/login | Supabase Auth | Real signup/password login; email confirmation handled without fake navigation |
| Profile display name | profiles.display_name | Read and save to current user's row; missing-row/RLS errors shown |
| Profile Google Connect | Supabase Google OAuth + google-freebusy | Link Google to the signed-in identity; request Calendar permissions; read primary-calendar busy blocks |
| Exact username search | profiles.username | Case-insensitive exact match; wildcard characters escaped |
| Friend request and response | send_friend_request / respond_friend_request | Use real RPCs, refresh from server only on success |
| Friends list / profile | friendships and public profile fields | Accepted friendships; actual names/usernames; no sample people mixed into signed-in data |
| Social group creation | create_group | Persist group name; current session remembers selected color |
| Invite on group creation | invite_to_group | Send selected invitations; explicitly report partial invitation failure |
| Notifications accept/decline | group_invitations / respond_group_invitation | Real membership only after acceptance |
| Group active-member selection | group_members | Compare actual active members; pending invitees excluded |
| Leave group | remove_group_member | Pass current authenticated user ID; server ownership restrictions/errors preserved |
| Availability grid | Google freeBusy + RLS-protected busy_slots | Read bounded ranges with pagination and Pacific timezone conversion |

Unauthenticated Explore remains Emily's session-only demo.
Authenticated operation failures never fall back to demo data or fake successful changes.
No service-role key is used in React.

## Frontend features missing backend support — no backend added

| Existing frontend feature | Missing support / current boundary |
| --- | --- |
| Bio, interests, activity notes, expiration | No fields/contracts in the reviewed backend. Session-only preview retained |
| Friends-only / groups / private sharing preference | No preference enforcement in reviewed RLS. Choices remain a labeled preview; current server access follows accepted friendships/shared membership |
| Interest-sharing and work-social toggles | No persistence/enforcement contract; preview only |
| Cancel outgoing friend request | No RPC or write policy. Existing control reports unsupported; no fake cancellation |
| Work-group mode/company directory | No group mode/company model. No work groups are created server-side |
| Work-group sharing days/hours | No persisted/enforced policy. Work creation is blocked with a status notice |
| Group colors and theme choices | No server fields; session-only appearance preserved |
| Fully reliable shared free-time display | busy_slots lacks sync coverage, freshness, disconnect state and persistent Google sync. Known busy blocks render, but absence of blocks is unknown, never proof of free time |
| Invitation preview of active members | Invited users can read groups/invitations but group_members RLS allows joined members only. Do not invent an active-member list |

## Backend features missing frontend controls — noted for later

| Existing backend/client feature | Missing UI |
| --- | --- |
| Multiple owned calendar URLs/IDs, ownership verification, calendar toggles | Emily's profile has one Connect button only. No URL/toggle UI added. Integrated view reads primary only |
| Calendar removal/disconnect / refresh requirements | No matching UI in this design; background refresh/revocation backend also incomplete |
| Group-owner update/delete privileges | No edit/delete group controls |
| Remove another group member RPC | Existing UI only exposes leaving, not owner member removal |
| Invite arbitrary nonfriends via invite_to_group | Current creation form chooses friends only; no arbitrary user/group invitation UI added |
| Groups visible to invitees and share-group availability | Nonfriend person profile remains locked by Emily's design; group member selection still works through authorized busy reads |
| Public username/avatar profile fields | Profile editor exposes name, not username/avatar editing |
| Supabase sign-out | No sign-out control in Emily's frontend; not added |

## Setup and live verification

Use frontend/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
(or legacy VITE_SUPABASE_ANON_KEY). This file is ignored.
Enable email/password auth. Apply the backend team's real profile trigger/schema and
latest social migration using their instructions; this branch does not change or apply SQL.

Enable Google OAuth and allow the frontend origin in Supabase redirects.
For an email/password user, Google Connect uses auth.linkIdentity, requiring Supabase
Authentication's manual identity linking setting. If disabled, the existing status area
shows the error instead of silently switching accounts.
Grant calendar.freebusy and calendar.calendarlist.readonly, and deploy the updated
google-freebusy function from gcal-sync. Its ALLOWED_ORIGINS must include the frontend
origin. Google provider-token expiration requires reconnecting; Supabase session refresh
does not refresh Google provider tokens.

Backend must expose profiles(id, username, display_name, avatar_url), friendships,
groups, group_members, group_invitations and busy_slots with the reviewed RLS/RPCs.
Existing profiles are never provisioned from React; signup depends on the backend's trigger.

Live authenticated data mutations and real Google consent have not been exercised by
automated tests. Browser tests intercept all Supabase requests; no test accounts, emails,
or database records are created. A final two-account test against the configured project
is still required, including stranger access denial and expired Google consent.

## Checks

From frontend:
- npm test — existing comparison/work-policy tests plus social mapping/RPC/error/timezone tests
- npm run test:browser — seven browser flows using mocked Supabase responses
- npm run build — production bundle

Browser checks use installed Chrome; configure playwright.config.js's channel for CI.
The test server runs on 127.0.0.1:5174 and does not require adding a real OAuth redirect.
No new styles were introduced; frontend/src/styles.css and lib/theme.js match Emily's commit.
