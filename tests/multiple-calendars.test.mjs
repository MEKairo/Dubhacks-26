import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarLink } from '../frontend/src/lib/calendarLinks.mjs';
import { loadLinkedCalendars, saveLinkedCalendars } from '../frontend/src/lib/linkedCalendars.mjs';
import { verifyOwnedCalendar, fetchOwnedBusy } from '../supabase/functions/_shared/calendar.mjs';

const a = 'one@group.calendar.google.com';
const b = 'two@group.calendar.google.com';
const start = '2026-10-18T09:00:00Z';
const end = '2026-10-18T17:00:00Z';
const busy = (s, e) => ({ start: '2026-10-18T' + s + ':00:00Z', end: '2026-10-18T' + e + ':00:00Z' });

test('parses src links, cid links, URL-safe cid links and plain IDs', () => {
  assert.equal(parseCalendarLink(a), a);
  assert.equal(parseCalendarLink('https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(a)), a);
  const cid = Buffer.from(a).toString('base64url');
  assert.equal(parseCalendarLink('https://calendar.google.com/calendar/u/0?cid=' + cid), a);
  assert.equal(parseCalendarLink('https://www.google.com/calendar/render?cid=' + cid), a);
});
test('rejects secret iCal URLs, arbitrary hosts and event links', () => {
  for (const link of ['https://calendar.google.com/calendar/ical/a/private-secret/basic.ics',
    'https://evil.example/calendar?src=' + a, 'https://calendar.google.com/calendar/event?eid=abc',
    'javascript:alert(1)', '', 'not-an-id']) assert.throws(() => parseCalendarLink(link));
});
test('only owner access can link a calendar', async () => {
  await assert.rejects(verifyOwnedCalendar('token', a, async () =>
    Response.json({ id: a, accessRole: 'writer' })), /Only calendars you own/);
  assert.equal((await verifyOwnedCalendar('token', a, async () =>
    Response.json({ id: a, summary: 'Work', accessRole: 'owner' }))).name, 'Work');
});
test('fetches selected calendars once and merges duplicate and overlapping busy blocks', async () => {
  let metadataCalls = 0;
  const result = await fetchOwnedBusy('token', start, end, [a, b, a], async (url, options) => {
    if (url.includes('/calendarList/')) {
      metadataCalls++;
      return Response.json({ id: decodeURIComponent(url.split('/').pop()), accessRole: 'owner' });
    }
    assert.deepEqual(JSON.parse(options.body).items, [{ id: a }, { id: b }]);
    return Response.json({ calendars: {
      [a]: { busy: [busy('10', '12')] },
      [b]: { busy: [busy('10', '12'), busy('11', '13')] },
    } });
  });
  assert.equal(metadataCalls, 2);
  assert.deepEqual(result.busy, [{ start: '2026-10-18T10:00:00.000Z', end: '2026-10-18T13:00:00.000Z' }]);
});
test('fails closed if one selected calendar fails and rejects empty selections', async () => {
  await assert.rejects(fetchOwnedBusy('token', start, end, []), /Select between/);
  await assert.rejects(fetchOwnedBusy('token', start, end, [a, b], async url => {
    if (url.includes('/calendarList/')) return Response.json({
      id: decodeURIComponent(url.split('/').pop()), accessRole: 'owner',
    });
    return Response.json({ calendars: { [a]: { busy: [] }, [b]: { errors: [{ reason: 'notFound' }] } } });
  }), /unknown/);
});
test('browser selections are isolated by user and persist toggles without credentials', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveLinkedCalendars('alice', [{ id: a, name: 'Work', enabled: false }], storage);
  assert.equal(loadLinkedCalendars('alice', storage)[0].enabled, false);
  assert.equal(loadLinkedCalendars('bob', storage)[0].id, 'primary');
});
