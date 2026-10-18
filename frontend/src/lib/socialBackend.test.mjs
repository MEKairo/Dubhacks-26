import test from 'node:test';
import assert from 'node:assert/strict';
import { socialSnapshot, socialBackend, readRows } from './socialBackend.mjs';
import { availabilityStatus, pacificTime } from './liveAvailability.mjs';

test('maps only accepted friendships and active memberships into comparisons', () => {
  const state = socialSnapshot('a', {
    friendships: [
      { id: 'f1', requester_id: 'a', addressee_id: 'b', status: 'accepted' },
      { id: 'f2', requester_id: 'c', addressee_id: 'a', status: 'pending' },
      { id: 'f3', requester_id: 'a', addressee_id: 'd', status: 'pending' },
    ],
    groups: [{ id: 'g', name: 'Crew', owner_id: 'b' }],
    members: [{ group_id: 'g', user_id: 'b' }],
    invitations: [{ id: 'i', group_id: 'g', inviter_id: 'b', invitee_id: 'a', status: 'pending' }],
  });
  assert.deepEqual(state.friends, ['b']);
  assert.deepEqual(state.requests, ['d']);
  assert.deepEqual(state.groups[0].active, ['b']);
  assert.deepEqual(state.groups[0].pending, ['me']);
  assert.equal(state.groups[0].joined, false);
  assert.deepEqual(state.notifications.map(n => n.id), ['f2', 'i']);
});
test('uses existing RPC contracts and reports partial invitation failures', async () => {
  const calls = [];
  const api = socialBackend({ rpc: async (name, args) => {
    calls.push([name, args]);
    return args.target_user === 'bad' ? { error: { message: 'denied' } } : { data: name === 'create_group' ? 'g' : null };
  } });
  const result = await api.createGroup(' Crew ', ['b', 'b', 'bad']);
  assert.deepEqual(result, { groupId: 'g', failedInvites: ['bad'] });
  assert.equal(calls.length, 3);
  await api.answer({ id: 'i', type: 'group' }, false);
  assert.deepEqual(calls.at(-1), ['respond_group_invitation', { invitation_id: 'i', accept_invite: false }]);
  await api.requestFriend('bob');
  assert.deepEqual(calls.at(-1), ['send_friend_request', { target_username: 'bob' }]);
});
test('does not treat missing or incomplete synced data as free', () => {
  const day = new Date(2026, 9, 18, 12);
  assert.equal(availabilityStatus({}, 'a', day, 10), null);
  assert.equal(availabilityStatus({ a: { busy: [], coverage: [] } }, 'a', day, 10), null);
  assert.equal(availabilityStatus({ a: {
    busy: [{ start: '2026-10-18T17:15:00Z', end: '2026-10-18T18:00:00Z' }], coverage: [],
  } }, 'a', day, 10), false);
  assert.equal(availabilityStatus({ a: { busy: [], coverage: [
    { start: '2026-10-18T07:00:00Z', end: '2026-10-19T07:00:00Z' },
  ] } }, 'a', day, 10), true);
});
test('Pacific timestamps handle daylight-saving transitions and nonexistent times', () => {
  assert.equal(new Date(pacificTime(new Date(2026, 10, 1, 12), 0)).toISOString(), '2026-11-01T07:00:00.000Z');
  assert.equal(pacificTime(new Date(2026, 2, 8, 12), 2.5), null);
});
test('paginates results and propagates backend errors instead of using demo data', async () => {
  let calls = 0;
  const rows = await readRows(() => ({ range: async offset => {
    calls++;
    return { data: offset === 0 ? Array(500).fill({}) : [{ id: 'last' }] };
  } }));
  assert.equal(rows.length, 501);
  assert.equal(calls, 2);
  await assert.rejects(readRows(() => ({ range: async () => ({ error: { message: 'policy denied' } }) })), /policy denied/);
});
