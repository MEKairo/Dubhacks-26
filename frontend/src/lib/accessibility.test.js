import test from 'node:test';
import assert from 'node:assert/strict';
import { themeTokens, contrastRatio } from './theme.js';
import { greeting } from './greeting.js';

test('generated foregrounds meet normal-text AA contrast across light, dark and saturated themes', () => {
  for (let red = 0; red <= 255; red += 51) for (let green = 0; green <= 255; green += 51) for (let blue = 0; blue <= 255; blue += 51) {
    const color = '#' + [red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('');
    const tokens = themeTokens(color);
    for (const surface of ['--surface', '--paper', '--desktop', '--cover', '--selected', '--mark', '--accent-soft']) {
      for (const text of ['--ink', '--muted', '--accent']) {
        assert.ok(contrastRatio(tokens[text], tokens[surface]) >= 4.5, `${color}: ${text} on ${surface}`);
      }
    }
    assert.ok(contrastRatio('#ffffff', tokens['--accent']) >= 4.5, `${color}: work button`);
  }
});

test('greeting uses device-local hours and changes at noon and 6pm', () => {
  for (const [hour, expected] of [[0,'Good morning'], [11,'Good morning'], [12,'Good afternoon'], [17,'Good afternoon'], [18,'Good evening'], [23,'Good evening']]) {
    assert.equal(greeting(new Date(2026, 9, 18, hour)), expected);
  }
});
