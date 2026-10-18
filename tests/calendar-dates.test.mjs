import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarQueryRange, localDateValue } from '../frontend/src/lib/calendarDates.mjs';

test('includes the entire last selected day and supports a single-day query', () => {
  const range = calendarQueryRange('2026-10-17', '2026-10-17');
  const start = new Date(range.timeMin);
  const end = new Date(range.timeMax);
  assert.equal(localDateValue(start), '2026-10-17');
  assert.equal(localDateValue(end), '2026-10-18');
  assert.equal(start.getHours(), 0);
  assert.equal(end.getHours(), 0);
});
test('rejects invalid dates, reversed dates and oversized API requests', () => {
  for (const [start, end] of [
    ['2026-02-30', '2026-03-01'], ['', '2026-10-17'],
    ['2026-10-18', '2026-10-17'], ['2026-01-01', '2026-03-01'],
  ]) assert.throws(() => calendarQueryRange(start, end));
});
test('uses local calendar-day boundaries across daylight-saving changes', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const range = calendarQueryRange('2026-11-01', '2026-11-01');
    assert.equal(range.timeMin, '2026-11-01T07:00:00.000Z');
    assert.equal(range.timeMax, '2026-11-02T08:00:00.000Z');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
