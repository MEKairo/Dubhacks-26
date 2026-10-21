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

function validateToken(token) {
  if (typeof token !== 'string' || !token || token.length > 8192) {
    throw new CalendarError('Reconnect Google Calendar.', 401);
  }
}
function validateCalendarId(id) {
  if (typeof id !== 'string' || id.length > 1024 ||
      (id !== 'primary' && !/^[^\s/?#]+@[^\s/?#]+$/.test(id))) {
    throw new CalendarError('Provide a valid Google Calendar ID.');
  }
  return id;
}
async function googleRequest(url, token, options = {}, fetcher = fetch) {
  validateToken(token);
  const response = await fetcher(url, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) throw new CalendarError('Google access expired. Reconnect Google Calendar.', 401);
  if (response.status === 403) throw new CalendarError('Reconnect Google Calendar and grant calendar list and free/busy permissions.', 403);
  if (response.status === 404) throw new CalendarError('Calendar not found in your Google account.', 404);
  if (response.status === 429) throw new CalendarError('Google is busy. Try again shortly.', 429);
  if (!response.ok) throw new CalendarError('Google Calendar could not be reached.', 502);
  return response.json();
}

export async function verifyOwnedCalendar(token, id, fetcher = fetch) {
  validateCalendarId(id);
  const calendar = await googleRequest(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList/' + encodeURIComponent(id),
    token, {}, fetcher,
  );
  if (calendar.accessRole !== 'owner' || calendar.deleted) {
    throw new CalendarError('Only calendars you own can be linked.', 403);
  }
  validateCalendarId(calendar.id);
  return { id: calendar.id, name: calendar.summaryOverride || calendar.summary || calendar.id,
    primary: Boolean(calendar.primary), timeZone: calendar.timeZone || null };
}

export function mergeBusyIntervals(intervals) {
  const ordered = intervals.map(({ start, end }) => validateRange(start, end))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of ordered) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged.map(({ start, end }) => ({
    start: new Date(start).toISOString(), end: new Date(end).toISOString(),
  }));
}

async function fetchBusy(token, timeMin, timeMax, ids, fetcher = fetch) {
  validateRange(timeMin, timeMax);
  const result = await googleRequest('https://www.googleapis.com/calendar/v3/freeBusy', token, {
    method: 'POST',
    body: JSON.stringify({ timeMin, timeMax, calendarExpansionMax: 50, items: ids.map(id => ({ id })) }),
  }, fetcher);
  const intervals = [];
  for (const id of ids) {
    const calendar = result.calendars?.[id];
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
      throw new CalendarError('A selected calendar could not be read. Availability is unknown.', 502);
    }
    for (const block of calendar.busy) {
      if (!block || typeof block !== 'object') throw new CalendarError('Invalid calendar response.', 502);
      validateRange(block.start, block.end);
      intervals.push({ start: block.start, end: block.end });
    }
  }
  return { timeMin, timeMax, busy: intervals };
}

// Legacy primary-only adapter retained for older callers.
export async function fetchPrimaryBusy(token, timeMin, timeMax, fetcher = fetch) {
  return fetchBusy(token, timeMin, timeMax, ['primary'], fetcher);
}

export async function fetchOwnedBusy(token, timeMin, timeMax, calendarIds, fetcher = fetch) {
  validateRange(timeMin, timeMax);
  if (!Array.isArray(calendarIds) || !calendarIds.length || calendarIds.length > 20) {
    throw new CalendarError('Select between 1 and 20 linked calendars.');
  }
  calendarIds.forEach(validateCalendarId);
  const calendars = await Promise.all([...new Set(calendarIds)].map(id => verifyOwnedCalendar(token, id, fetcher)));
  const ids = [...new Set(calendars.map(calendar => calendar.id))];
  const result = await fetchBusy(token, timeMin, timeMax, ids, fetcher);
  return { ...result, calendarIds: ids, busy: mergeBusyIntervals(result.busy) };
}
