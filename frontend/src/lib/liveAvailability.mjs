export function pacificTime(date, hour = 0) {
  const year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
  const target = Date.UTC(year, month - 1, day, Math.floor(hour), (hour % 1) * 60);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const p = kind => Number(parts.find(v => v.type === kind).value);
    const wall = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'));
    if (wall === target) return instant;
    instant += target - wall;
  }
  return null; // A nonexistent spring-forward wall time must not appear as free.
}
export function intervalStatus(snapshot, from, to) {
  if (!snapshot || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (snapshot.busy.some(block => Date.parse(block.start) < to && Date.parse(block.end) > from)) return false;
  return snapshot.coverage?.some(range => Date.parse(range.start) <= from && Date.parse(range.end) >= to) ? true : null;
}
export function availabilityStatus(snapshots, id, day, hour) {
  const from = pacificTime(day, hour);
  if (from === null) return null;
  return intervalStatus(snapshots[id], from, from + 30 * 60000);
}
