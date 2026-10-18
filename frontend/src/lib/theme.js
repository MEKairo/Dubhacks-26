function mix(hex, target, amount) {
  const values = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
  return `#${values.map(value => Math.round(value + (target - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function themeTokens(color) {
  return {
    '--personal-color': color,
    '--accent': mix(color, 0, .55),
    '--accent-soft': mix(color, 255, .65),
    '--selected': mix(color, 255, .87),
    '--desktop': mix(color, 255, .91),
    '--dot': mix(color, 255, .67),
    '--surface': mix(color, 255, .97),
    '--paper': mix(color, 255, .985),
    '--line': mix(color, 255, .40),
    '--shadow': mix(color, 255, .65),
    '--cover': mix(color, 255, .94),
  };
}
