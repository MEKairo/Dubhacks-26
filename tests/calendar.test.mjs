import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPrimaryBusy, findSharedAvailability, validateRange } from '../supabase/functions/_shared/calendar.mjs';
const t = hour => '2026-10-18T' + String(hour).padStart(2, '0') + ':00:00Z';
const block = (start, end) => ({ start: t(start), end: t(end) });

test('combines overlapping busy times from friends and clips to working hours', () => {
  const result = findSharedAvailability([[block(8, 10), block(12, 14)], [block(13, 15)]], [block(9, 17)]);
  assert.deepEqual(result, [
    { start: new Date(t(10)).toISOString(), end: new Date(t(12)).toISOString() },
    { start: new Date(t(15)).toISOString(), end: new Date(t(17)).toISOString() },
  ]);
});
test('fully busy windows and slots shorter than requested return no availability', () => {
  assert.deepEqual(findSharedAvailability([[block(8, 18)]], [block(9, 17)]), []);
  assert.deepEqual(findSharedAvailability([[]], [block(9, 10)], 90), []);
});
test('empty calendars are free but missing members are not accepted', () => {
  assert.equal(findSharedAvailability([[], []], [block(9, 17)]).length, 1);
  assert.throws(() => findSharedAvailability([null], [block(9, 17)]));
  assert.throws(() => findSharedAvailability([], [block(9, 17)]));
});
test('rejects invalid ranges, overlapping windows, and excessive queries', () => {
  assert.throws(() => validateRange(t(17), t(9)));
  assert.throws(() => validateRange('2026-10-18T09:00:00', t(17)));
  assert.throws(() => validateRange(t(9), '2027-01-01T00:00:00Z'));
  assert.throws(() => findSharedAvailability([[]], [block(9, 12), block(11, 17)]));
});
test('fetches only primary freebusy and strips event details', async () => {
  const result = await fetchPrimaryBusy('test-token', t(9), t(17), async (url, options) => {
    assert.equal(url, 'https://www.googleapis.com/calendar/v3/freeBusy');
    assert.deepEqual(JSON.parse(options.body).items, [{ id: 'primary' }]);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return Response.json({ calendars: { primary: { busy: [{ ...block(10, 11), title: 'private' }] } } });
  });
  assert.deepEqual(result.busy, [block(10, 11)]);
});
test('does not mistake provider errors or missing calendars for free time', async () => {
  for (const payload of [{}, { calendars: { primary: { errors: [{ reason: 'notFound' }] } } }]) {
    await assert.rejects(fetchPrimaryBusy('token', t(9), t(17), async () => Response.json(payload)), /unknown/);
  }
  await assert.rejects(fetchPrimaryBusy('expired', t(9), t(17), async () => new Response(null, { status: 401 })), /Reconnect/);
});
