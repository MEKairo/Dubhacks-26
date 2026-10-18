import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonMembers } from './comparison.js';

test('notes can compare multiple friends without duplicate calendars', () => {
  assert.deepEqual(comparisonMembers(['maya', 'kairo'], ['maya', 'kairo', 'maya']), ['me', 'maya', 'kairo']);
});

test('clearing note selections restores the personal calendar', () => {
  assert.deepEqual(comparisonMembers(['maya', 'kairo'], []), ['me']);
});

test('clearing profile additions preserves you and the original friend', () => {
  assert.deepEqual(comparisonMembers(['maya', 'kairo'], [], 'maya'), ['me', 'maya']);
  assert.deepEqual(comparisonMembers(['maya', 'kairo'], ['maya', 'kairo'], 'maya'), ['me', 'maya', 'kairo']);
});

test('additional comparisons exclude people who are not friends', () => {
  assert.deepEqual(comparisonMembers(['maya'], ['jules', 'maya'], 'maya'), ['me', 'maya']);
});
