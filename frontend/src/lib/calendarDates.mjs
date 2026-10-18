export function localDateValue(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Choose valid start and end dates.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (localDateValue(date) !== value) throw new Error('Choose valid start and end dates.');
  return date;
}

export function calendarQueryRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) throw new Error('The end date must be on or after the start date.');
  // End date is inclusive in the UI, exclusive in the Google query.
  end.setDate(end.getDate() + 1);
  if (end - start > 31 * 86400000) throw new Error('Choose a range shorter than 31 days.');
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}
