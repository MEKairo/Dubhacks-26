function mix(hex, target, amount) {
  const values = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
  return `#${values.map(value => Math.round(value + (target - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function contrastRatio(first, second) {
  const luminance = hex => hex.slice(1).match(/.{2}/g).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export function readableText(color, backgrounds) {
  for (let amount = 0; amount <= 1; amount += .02) {
    const candidate = mix(color, 0, amount);
    // Leave a margin above AA for the subtle hover brightness effect.
    if (backgrounds.every(background => contrastRatio(candidate, background) >= 5)) return candidate;
  }
  return '#000000';
}

export function themeTokens(color) {
  const tokens = {
    '--personal-color': color,
    '--accent': mix(color, 0, .55),
    '--accent-soft': mix(color, 255, .65),
    '--selected': mix(color, 255, .87),
    '--mark': mix(color, 255, .65),
    '--desktop': mix(color, 255, .91),
    '--dot': mix(color, 255, .67),
    '--surface': mix(color, 255, .97),
    '--paper': mix(color, 255, .985),
    '--line': mix(color, 255, .40),
    '--shadow': mix(color, 255, .65),
    '--cover': mix(color, 255, .94),
  };
  const backgrounds = ['--desktop', '--surface', '--paper', '--selected', '--accent-soft', '--cover', '--mark'].map(key => tokens[key]);
  tokens['--ink'] = readableText('#302938', backgrounds);
  tokens['--muted'] = readableText('#514959', backgrounds);
  tokens['--accent'] = readableText(tokens['--accent'], backgrounds);
  return tokens;
}
