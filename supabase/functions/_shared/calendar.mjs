export class CalendarError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validateRange(timeMin, timeMax) {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  const start = Date.parse(timeMin);
  const end = Date.parse(timeMax);
  if (typeof timeMin !== 'string' || typeof timeMax !== 'string' ||
      !iso.test(timeMin) || !iso.test(timeMax) ||
      !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new CalendarError('Provide a valid timeMin and timeMax with timezone offsets.');
  }
  if (end - start > 31 * 86400000) throw new CalendarError('Request at most 31 days at a time.');
  return { start, end };
}

// Explicit windows let the caller choose local working hours without assuming a timezone.
export function findSharedAvailability(busyByMember, windows, minimumMinutes = 30) {
  if (!Array.isArray(busyByMember) || !busyByMember.length ||
      busyByMember.some(busy => !Array.isArray(busy))) {
    throw new CalendarError('Busy times are required for every selected member.');
  }
  if (!Array.isArray(windows) || !Number.isFinite(minimumMinutes) || minimumMinutes <= 0) {
    throw new CalendarError('Provide windows and a positive minimum duration.');
  }
  const intervals = busyByMember.flat().map(({ start, end }) => validateRange(start, end))
    .sort((a, b) => a.start - b.start);
  const sortedWindows = windows.map(({ start, end }) => validateRange(start, end))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < sortedWindows.length; i++) {
    if (sortedWindows[i].start < sortedWindows[i - 1].end) {
      throw new CalendarError('Availability windows must not overlap.');
    }
  }
  const available = [];
  const add = (start, end) => {
    if (end - start >= minimumMinutes * 60000) {
      available.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
  };
  for (const window of sortedWindows) {
    let cursor = window.start;
    for (const busy of intervals) {
      if (busy.end <= cursor) continue;
      if (busy.start >= window.end) break;
      add(cursor, Math.min(busy.start, window.end));
      cursor = Math.max(cursor, Math.min(busy.end, window.end));
    }
    add(cursor, window.end);
  }
  return available;
}

export async function fetchPrimaryBusy(token, timeMin, timeMax, fetcher = fetch) {
  validateRange(timeMin, timeMax);
  if (typeof token !== 'string' || !token || token.length > 8192) {
    throw new CalendarError('Reconnect Google Calendar.', 401);
  }
  const response = await fetcher('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) throw new CalendarError('Google access expired. Reconnect Google Calendar.', 401);
  if (response.status === 403) throw new CalendarError('Enable Calendar API and grant calendar.freebusy permission.', 403);
  if (response.status === 429) throw new CalendarError('Google is busy. Try again shortly.', 429);
  if (!response.ok) throw new CalendarError('Google Calendar could not be reached.', 502);
  const result = await response.json();
  const calendar = result.calendars?.primary;
  // Missing/error calendars must never be interpreted as an entirely free calendar.
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
    throw new CalendarError('Google could not read this calendar. Availability is unknown.', 502);
  }
  const busy = calendar.busy.map(({ start, end }) => {
    validateRange(start, end);
    return { start, end };
  });
  return { timeMin, timeMax, busy };
}
