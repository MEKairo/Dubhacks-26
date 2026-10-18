export const defaultTimeline = { includeWeekends: false, startHour: 9, endHour: 17 };
export function withinTimeline(date, hour, timeline) {
  if (!timeline) return true;
  return (timeline.includeWeekends || ![0, 6].includes(date.getDay())) && hour >= timeline.startHour && hour < timeline.endHour;
}
export function timelineSummary(timeline) {
  if (!timeline) return '';
  const time = value => `${String(Math.floor(value)).padStart(2, '0')}:${value % 1 ? '30' : '00'}`;
  return `${timeline.includeWeekends ? 'Every day' : 'Monday–Friday'} · ${time(timeline.startHour)}–${time(timeline.endHour)} Pacific`;
}
