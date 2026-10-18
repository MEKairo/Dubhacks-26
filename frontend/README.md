# Moment frontend

React + Vite prototype. Requires Node.js 22.14 or newer.

## Run

From `frontend/`, use `npm install` then `npm run dev`. On Windows PowerShell use `npm.cmd` if scripts are blocked.

For Live Server, run `npm run build` then open `frontend/dist/index.html`. Rebuild after each source edit. Never edit generated files in `dist/`.

## Files to edit

- `src/pages/Welcome.jsx`: cover and login/signup preview.
- `src/pages/ProfileSetup.jsx`: setup, interests, and sharing choices.
- `src/pages/SocialApp.jsx`: sidebar, main calendar, notifications, people/search, groups/creation, member filters, and friend profiles.
- `src/components/AvailabilityCalendar.jsx`: day/week/month views, gradients, slot counts.
- `src/components/MomentLogo.jsx`: wordmark with clock o.
- `src/App.jsx`: navigation, theme and session state.
- `src/data/demo.js`: sample people, groups, invites, color choices.
- `src/lib/availability.js`: synthetic availability calculations.
- `src/styles.css`: layout, animation, responsive rules, and palette tokens in `.app` / `.theme-work`.

## Try the flow

- Signup opens setup; login opens the calendar. Explore links bypass credentials.
- Finish setup to open the calendar. All social screens have My calendar in the navigation.
- Notifications includes Alex's friend request and Maya's group invitation. Accept/decline updates the demo. Group invites list active and pending people before joining.
- My people searches exact usernames: `sam.p`, `jules.p`, `alex.m`. Send and cancel demo requests.
- My groups opens joined groups. Create a group, choose a color, and invite friends. They remain pending and are excluded from availability. Leave both starting groups to try the empty state.
- Group checkboxes support everyone, nobody, or a single person's availability.
- Maya has a full friend profile and one-to-one calendar. Jules is a group member but not a friend: avatar and request button only.
- Edit the profile's activity note with a one-day, one-week, or until-removed duration. It appears on the main calendar. Friends' sample notes have a scrolling panel. Own note expiry is checked every 30 seconds on social screens.

Darker cells mean more selected members are free. Day/week cover all 24 hours in half-hour slots; clicking a slot gives an exact count. Month is an overview; clicking a date opens day view. Demo today is October 17, 2026. All availability is synthetic.

Work has separate groups, restricted sharing windows, and professional styling. The company directory is deferred.

## Prototype boundaries

No account, password, request, or invitation is sent to a server. All state resets on refresh. Screen navigation preserves edits and supports browser back/forward. There is no messaging system.

Authentication, syncing, real invitations, note persistence/expiry, and sharing enforcement need backend integration. Friend profile restrictions here are UI behavior, not server access controls. Palettes are temporary and have not had a full contrast audit.

## Updated social and work behavior

Activity notes now live in `src/pages/NoteEditor.jsx`, linked only from the main Social calendar's notes panel. They are no longer edited during profile setup.

Work has separate groups (`mode: 'work'`), professional typography, and no activity notes. Creating a work group sets `timeline: { includeWeekends, startHour, endHour }`. Hours are decimal values in half-hour increments, in Pacific time. `src/lib/workPolicy.js` describes these boundaries; day/week/month views omit or disable availability outside them. The backend must enforce the same window when returning availability, including for individual-member queries.

A sample Product team group includes Jules (work-interest sharing on) and Sam (off). Their non-friend Work profiles show company email and an add-friend action; only opted-in interests appear. Bios, personal notes, and one-to-one calendar access remain restricted. The company directory is a placeholder; creating a work group currently invites from existing friends.

Hover/focus a group slot to show per-member Free/Busy status, or tap/click to pin it. Busy names are crossed out independently of their selection checkbox. Leaving requires a confirmation dialog.

On laptop widths above 900px, main/group calendars fit the application viewport. Other content panels may scroll independently. Smaller screens use a native modal navigation drawer with Escape/backdrop/close controls, and scrollable time grids to keep slots usable.

Check work-window rules with `node --test src/lib/workPolicy.test.js` from `frontend/`. All backend actions are still simulated; Work visibility restrictions here are frontend behavior until server authorization is connected.

## Calendar zoom and personal theme

Day/week grids use a shared 24px default half-hour height rather than squeezing 24 hours into the viewport. Full-day calendars open around 8am, and times outside the viewport remain available through internal scrolling. The bottom-right zoom slider scales time blocks from 75% to 200%, preserving the scroll position in time. Work sharing windows still constrain the visible days/hours.

The header color picker sets separate Social and Work colors in session state. `src/lib/theme.js` derives surface/accent tokens; the selected color also controls personal and one-to-one calendars. Group calendars retain their assigned group colors. Friend notes scroll vertically inside their panel instead of extending the laptop page.

## Temporary friend comparisons

In Social mode, check friends' note cards to overlay their availability on your main calendar. Deselect all restores just your calendar. On a friend's profile, the right panel searches your friends by name/username and adds/removes their calendars. The original friend and you remain included when clearing additions. These comparisons do not create groups or send invitations, and only existing friends can be added. Work behavior is unchanged.

`src/lib/comparison.js` builds the member lists. Run `node --test src/lib/comparison.test.js src/lib/workPolicy.test.js` from `frontend/` to verify selection reset and work-window rules.
