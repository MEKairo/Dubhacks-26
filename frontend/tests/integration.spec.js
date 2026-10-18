import { test, expect } from '@playwright/test';

const me = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const newcomer = '00000000-0000-0000-0000-000000000003';
const user = { id: me, email: 'test@example.com', aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [] };
const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' +
  Buffer.from(JSON.stringify({ sub: me, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url') + '.test-signature';

async function mockBackend(page, { incoming = false } = {}) {
  const calls = [];
  const profiles = [
    { id: me, username: 'alice', display_name: 'Alice', avatar_url: null },
    { id: bob, username: 'bob', display_name: 'Bob', avatar_url: null },
    { id: newcomer, username: 'new_user', display_name: 'New Person', avatar_url: null },
  ];
  const tables = { friendships: [{ id: 'friend-1', requester_id: me, addressee_id: bob, status: 'accepted' }],
    groups: [], group_members: [], group_invitations: [], busy_slots: [] };
  if (incoming) tables.friendships.push({ id: 'incoming-1', requester_id: newcomer, addressee_id: me, status: 'pending' });
  await page.route('https://*.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const reply = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') return reply({
      access_token: token, refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer', user,
    });
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').pop();
      const args = request.postDataJSON();
      calls.push({ name, args });
      if (name === 'send_friend_request') {
        tables.friendships.push({ id: 'outgoing', requester_id: me, addressee_id: newcomer, status: 'pending' });
        return reply('outgoing');
      }
      if (name === 'create_group') {
        tables.groups.push({ id: 'group-1', name: args.group_name, owner_id: me });
        tables.group_members.push({ group_id: 'group-1', user_id: me });
        return reply('group-1');
      }
      if (name === 'respond_friend_request') {
        tables.friendships.find(f => f.id === args.request_id).status = args.accept_request ? 'accepted' : 'rejected';
      }
      if (name === 'invite_to_group') {
        tables.group_invitations.push({ id: 'invite-1', group_id: args.target_group, inviter_id: me, invitee_id: args.target_user, status: 'pending' });
      }
      return reply(null);
    }
    if (url.pathname === '/rest/v1/profiles') {
      if (request.method() === 'PATCH') {
        const update = request.postDataJSON();
        calls.push({ name: 'save-profile', args: update });
        Object.assign(profiles[0], update);
        return reply(profiles[0]);
      }
      const exact = url.searchParams.get('username');
      return reply(exact ? profiles.filter(p => p.username === exact.slice(6).replace(/\\/g, '')) : profiles);
    }
    const name = url.pathname.split('/').pop();
    if (name in tables) return reply(tables[name]);
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Unmocked endpoint ' + url.pathname }) });
  });
  return calls;
}
async function login(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s find the time.' }).click();
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByLabel('Email address').fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: /Open my calendar/ }).click();
  await expect(page).toHaveURL(/#calendar$/);
  await expect(page.getByText('Your time, Alice.')).toBeVisible();
}
test('login loads real people, exact search and friend request use the existing backend', async ({ page }) => {
  const calls = await mockBackend(page);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await login(page);
  await page.getByRole('link', { name: 'My people', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible();
  await expect(page.getByText('Maya Chen')).toHaveCount(0);
  await page.getByLabel('Exact username').fill('new_user');
  await page.getByRole('button', { name: 'Find person' }).click();
  await page.getByRole('button', { name: 'Send friend request', exact: true }).click();
  await expect.poll(() => calls.some(call => call.name === 'send_friend_request')).toBe(true);
  expect(calls.find(call => call.name === 'send_friend_request').args).toEqual({ target_username: 'new_user' });
  await expect(page.getByRole('button', { name: 'Request sent', exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
test('existing group form creates a group and sends selected invitations', async ({ page }) => {
  const calls = await mockBackend(page);
  await login(page);
  await page.goto('/#new-group');
  await page.getByLabel('Group name').fill('Weekend crew');
  await page.locator('.invite-friend input').first().check();
  await page.getByRole('button', { name: 'Create & invite 1', exact: true }).click();
  await expect(page).toHaveURL(/#group\/group-1$/);
  expect(calls.filter(call => ['create_group', 'invite_to_group'].includes(call.name))).toEqual([
    { name: 'create_group', args: { group_name: 'Weekend crew' } },
    { name: 'invite_to_group', args: { target_group: 'group-1', target_user: bob } },
  ]);
  await expect(page.getByRole('heading', { name: 'Weekend crew', exact: true })).toBeVisible();
});
test('unsupported work group policies do not create fake backend groups', async ({ page }) => {
  const calls = await mockBackend(page);
  await login(page);
  await page.getByRole('button', { name: 'Work', exact: true }).click();
  await page.goto('/#new-group');
  await page.getByLabel('Group name').fill('Work team');
  await page.getByRole('button', { name: 'Create group', exact: true }).click();
  await expect(page.getByText('Work-group modes and sharing windows are not supported by the backend yet. Nothing was saved.')).toBeVisible();
  expect(calls.some(call => call.name === 'create_group')).toBe(false);
});
test('profile saves only supported display name; unsynced availability is unknown', async ({ page }) => {
  const calls = await mockBackend(page);
  await login(page);
  await page.goto('/#profile');
  await page.getByRole('button', { name: /A little about you/ }).click();
  await page.getByLabel('What should we call you?').fill('Alice Updated');
  await page.getByLabel(/A little about you/).fill('Local-only bio');
  await page.getByRole('button', { name: /Sharing choices/ }).click();
  await page.getByRole('button', { name: /Open my calendar/ }).click();
  await expect(page).toHaveURL(/#calendar$/);
  expect(calls.find(call => call.name === 'save-profile').args).toEqual({ display_name: 'Alice Updated' });
  await expect(page.locator('.availability-cell').first()).toHaveAttribute('aria-label', /availability unknown/);
});

test('notifications accept incoming friend requests through the real RPC contract', async ({ page }) => {
  const calls = await mockBackend(page, { incoming: true });
  await login(page);
  await page.goto('/#notifications');
  await page.getByRole('button', { name: 'Accept friend request', exact: true }).click();
  await expect(page.getByText('accepted', { exact: true })).toBeVisible();
  expect(calls.find(call => call.name === 'respond_friend_request').args).toEqual({ request_id: 'incoming-1', accept_request: true });
});
test('backend action failures are shown without creating fake requests', async ({ page }) => {
  await mockBackend(page);
  await page.route('**/rest/v1/rpc/send_friend_request', route => route.fulfill({
    status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Request denied by backend' }),
  }));
  await login(page);
  await page.goto('/#people');
  await page.getByLabel('Exact username').fill('new_user');
  await page.getByRole('button', { name: 'Find person' }).click();
  await page.getByRole('button', { name: 'Send friend request', exact: true }).click();
  await expect(page.getByText('Request denied by backend', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request sent', exact: true })).toHaveCount(0);
});
test('Google connection links the existing identity and exposes configuration errors', async ({ page }) => {
  await mockBackend(page);
  let identityRequest = false;
  await page.route('**/auth/v1/user/identities/authorize?**', route => {
    identityRequest = true;
    return route.fulfill({ status: 400, contentType: 'application/json',
      body: JSON.stringify({ msg: 'Manual linking is disabled', code: 'manual_linking_disabled' }) });
  });
  await login(page);
  await page.goto('/#profile');
  await page.getByRole('button', { name: /^Connect/ }).click();
  await expect(page.getByText('Manual linking is disabled', { exact: true })).toBeVisible();
  expect(identityRequest).toBe(true);
});

test('Connect shows progress and redirects the current tab to Google', async ({ page }) => {
  await mockBackend(page);
  await page.route('**/auth/v1/user/identities/authorize?**', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ url: 'https://accounts.google.com/test-consent' }) });
  });
  await page.route('https://accounts.google.com/test-consent', route => route.fulfill({
    contentType: 'text/html', body: '<h1>Google consent test</h1>',
  }));
  await login(page);
  await page.goto('/#profile');
  await page.getByRole('button', { name: /^Connect/ }).click();
  await expect(page.getByText('Opening Google sign-in in this tab…')).toBeVisible();
  await expect(page).toHaveURL('https://accounts.google.com/test-consent');
});
test('Explore clearly explains why Connect cannot start without sign-in', async ({ page }) => {
  await page.goto('/#profile');
  await page.getByRole('button', { name: /^Connect/ }).click();
  await expect(page.getByText(/Sign in before connecting Google Calendar. Open Welcome screen/)).toBeVisible();
});
