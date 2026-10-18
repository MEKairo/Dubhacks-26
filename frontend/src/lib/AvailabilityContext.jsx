import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { getMyBusyTimes } from './googleCalendar.js';
import { readRows } from './socialBackend.mjs';
import { availabilityStatus, pacificTime } from './liveAvailability.mjs';

export const AvailabilityContext = createContext(null);
export function useLiveAvailability(start, end, memberIds) {
  const live = useContext(AvailabilityContext);
  const [snapshot, setSnapshot] = useState({ key: '', data: {}, loading: false, error: '' });
  const ids = [...new Set(memberIds)].sort();
  const from = pacificTime(start);
  const until = pacificTime(end);
  const key = JSON.stringify([live?.session.user.id, live?.session.provider_token ? 'connected' : '', ids, from, until, live?.revision]);
  useEffect(() => {
    if (!live || !ids.length || from === null || until === null) return;
    let active = true;
    setSnapshot({ key, data: {}, loading: true, error: '' });
    (async () => {
      const result = Object.fromEntries(ids.map(id => [id, { busy: [], coverage: [] }]));
      const otherIds = ids.filter(id => id !== 'me');
      if (otherIds.length) {
        const slots = await readRows(() => supabase.from('busy_slots').select('id,user_id,starts_at,ends_at')
          .in('user_id', otherIds).lt('starts_at', new Date(until).toISOString())
          .gt('ends_at', new Date(from).toISOString()).order('id'));
        for (const slot of slots) result[slot.user_id]?.busy.push({ start: slot.starts_at, end: slot.ends_at });
        // The backend has no sync-coverage metadata, so empty intervals are unknown.
      }
      let warning = '';
      if (ids.includes('me')) {
        if (live.session.provider_token) {
          // Emily's Connect UI currently represents the primary calendar only.
          // Calendar URL input/toggles remain pending frontend design.
          const selected = ['primary'];
          try {
            for (let cursor = from; cursor < until; cursor += 30 * 86400000) {
              const end = Math.min(until, cursor + 30 * 86400000);
              const data = await getMyBusyTimes(new Date(cursor).toISOString(), new Date(end).toISOString(), selected);
              result.me.busy.push(...data.busy);
              result.me.coverage.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString() });
            }
          } catch (e) { result.me = { busy: [], coverage: [] }; warning = e.message; }
        } else warning = 'Connect Google Calendar in your profile to load your availability.';
      }
      if (active) setSnapshot({ key, data: result, loading: false, error: warning });
    })().catch(e => { if (active) setSnapshot({ key, data: {}, loading: false, error: e.message }); });
    return () => { active = false; };
  }, [key]);
  if (!live) return null;
  const current = snapshot.key === key ? snapshot : { data: {}, loading: true, error: '' };
  return { loading: current.loading, error: current.error,
    status: (id, day, hour) => availabilityStatus(current.data, id, day, hour) };
}
