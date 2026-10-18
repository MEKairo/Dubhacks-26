export function pacificToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const part = type => Number(parts.find(value => value.type === type).value);
  return new Date(part('year'), part('month') - 1, part('day'), 12);
}
