import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTimeline, withinTimeline } from './workPolicy.js';

const monday = new Date(2026, 9, 12, 12);
const saturday = new Date(2026, 9, 17, 12);

test('work availability includes opening time and excludes closing time', () => {
  assert.equal(withinTimeline(monday, 8.5, defaultTimeline), false);
  assert.equal(withinTimeline(monday, 9, defaultTimeline), true);
  assert.equal(withinTimeline(monday, 16.5, defaultTimeline), true);
  assert.equal(withinTimeline(monday, 17, defaultTimeline), false);
});

test('weekends are hidden unless the creator includes them', () => {
  assert.equal(withinTimeline(saturday, 12, defaultTimeline), false);
  assert.equal(withinTimeline(saturday, 12, { ...defaultTimeline, includeWeekends: true }), true);
  assert.equal(withinTimeline(saturday, 20, { ...defaultTimeline, includeWeekends: true }), false);
});

test('half-hour and full-day work windows retain their boundaries', () => {
  const halfHour = { includeWeekends: false, startHour: 9.5, endHour: 10.5 };
  assert.equal(withinTimeline(monday, 9, halfHour), false);
  assert.equal(withinTimeline(monday, 9.5, halfHour), true);
  assert.equal(withinTimeline(monday, 10.5, halfHour), false);
  assert.equal(withinTimeline(saturday, 23.5, { includeWeekends: true, startHour: 0, endHour: 24 }), true);
});

test('social availability has no work-window restriction', () => {
  assert.equal(withinTimeline(saturday, 23.5), true);
});
