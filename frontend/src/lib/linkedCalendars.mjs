const prefix = 'calendar-links:v1:';
export const defaultCalendars = () => [{ id: 'primary', name: 'Primary calendar', enabled: true }];

export function loadLinkedCalendars(userId, storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(prefix + userId));
    if (!Array.isArray(saved) || saved.length > 20 || saved.some(c =>
      !c || typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.enabled !== 'boolean')) {
      return defaultCalendars();
    }
    return [...new Map(saved.map(c => [c.id, { id: c.id, name: c.name, enabled: c.enabled }])).values()];
  } catch { return defaultCalendars(); }
}

export function saveLinkedCalendars(userId, calendars, storage = localStorage) {
  // Calendar identifiers/settings only. Never store Google credentials here.
  storage.setItem(prefix + userId, JSON.stringify(calendars));
}
