import React, { useEffect, useRef, useState } from 'react';
import { connectGoogleCalendar, getMyBusyTimes, linkOwnedCalendar, supabase } from '../lib/googleCalendar.js';
import { calendarQueryRange, localDateValue } from '../lib/calendarDates.mjs';
import { parseCalendarLink } from '../lib/calendarLinks.mjs';
import { loadLinkedCalendars, saveLinkedCalendars } from '../lib/linkedCalendars.mjs';
import './GoogleCalendarConnect.css';

const formatTime = value => new Date(value).toLocaleString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function GoogleCalendarConnect() {
  const [session, setSession] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [calendarLink, setCalendarLink] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [startDate, setStartDate] = useState(() => localDateValue());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 6);
    return localDateValue(date);
  });
  const generation = useRef(0);
  const currentUser = useRef(null);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (currentUser.current !== (next?.user.id ?? null)) {
        generation.current += 1;
        currentUser.current = next?.user.id ?? null;
        setCalendars(next ? loadLinkedCalendars(next.user.id) : []);
        setCalendarLink('');
        setResult(null);
        setError('');
        setPending('');
      }
      setSession(next);
    });
    return () => { generation.current += 1; subscription.unsubscribe(); };
  }, []);
  async function run(label, action) {
    const version = ++generation.current;
    setPending(label);
    setError('');
    setResult(null);
    try {
      const next = await action();
      if (generation.current === version && next) setResult(next);
    } catch (e) {
      if (generation.current === version) setError(e.message || 'Something went wrong. Try again.');
    } finally {
      if (generation.current === version) setPending('');
    }
  }
  function changeDate(setter, value) {
    generation.current += 1;
    setter(value);
    setResult(null);
    setError('');
    setPending('');
  }
  function updateCalendars(next) {
    generation.current += 1;
    setCalendars(next);
    setPending('');
    setResult(null);
    setError('');
    try { saveLinkedCalendars(currentUser.current, next); }
    catch { setError('Selection changed, but this browser could not save it for next time.'); }
  }
  const enabledIds = calendars.filter(c => c.enabled).map(c => c.id);
  const connected = Boolean(session?.provider_token);
  return (
    <section className="calendar-panel" aria-labelledby="calendar-heading">
      <header>
        <p className="eyebrow">Google Calendar</p>
        <h2 id="calendar-heading">Check your busy times</h2>
        <p>Use your existing calendar to find room for plans. Event names and details stay private.</p>
      </header>

      <div className="calendar-connection">
        <div>
          <strong>{!supabase ? 'Connection setup needed' : connected ? 'Google account connected' : 'Connect your calendar'}</strong>
          <p>{session?.user.email || 'Read availability from calendars you own.'}</p>
        </div>
        <button disabled={Boolean(pending) || !supabase}
          onClick={() => run('Opening Google...', connectGoogleCalendar)}>
          {session ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
        </button>
        {session && <button disabled={Boolean(pending)} onClick={() => run('Signing out...', async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        })}>Sign out</button>}
      </div>
      {!supabase && <p role="status">Calendar connection is not configured yet. You can choose dates, but fetching busy times will be available after setup.</p>}


      <section aria-labelledby="linked-calendars-heading">
        <h3 id="linked-calendars-heading">Your linked calendars</h3>
        <p>Link calendars you own using their Google Calendar browser link or Calendar ID.</p>
        <form onSubmit={event => {
          event.preventDefault();
          const userId = currentUser.current;
          run('Verifying calendar...', async () => {
            const id = parseCalendarLink(calendarLink);
            const { calendar } = await linkOwnedCalendar(id);
            if (currentUser.current !== userId) return;
            const existing = calendars.find(c => c.id === calendar.id || (calendar.primary && c.id === 'primary'));
            const next = existing ? calendars.map(c => c === existing
              ? { id: calendar.id, name: calendar.name, enabled: c.enabled } : c)
              : [...calendars, { id: calendar.id, name: calendar.name, enabled: true }];
            if (next.length > 20) throw new Error('You can link up to 20 calendars.');
            updateCalendars(next);
            setCalendarLink('');
          });
        }}>
          <div className="calendar-controls">
            <label>Calendar link or ID<input type="text" required maxLength={4096}
              placeholder="https://calendar.google.com/calendar/..."
              value={calendarLink} disabled={!connected || Boolean(pending)}
              onChange={event => setCalendarLink(event.target.value)} /></label>
            <button type="submit" disabled={!connected || Boolean(pending)}>Link calendar</button>
          </div>
        </form>
        <ul className="calendar-busy-list">
          {calendars.map(calendar => <li key={calendar.id}>
            <label><input type="checkbox" checked={calendar.enabled} disabled={Boolean(pending)}
              onChange={event => updateCalendars(calendars.map(c => c.id === calendar.id
                ? { ...c, enabled: event.target.checked } : c))} /> {calendar.name}</label>
            <button type="button" disabled={Boolean(pending)}
              aria-label={'Remove ' + calendar.name}
              onClick={() => updateCalendars(calendars.filter(c => c.id !== calendar.id))}>Remove</button>
          </li>)}
        </ul>
        {!enabledIds.length && <p>Select at least one calendar before checking busy times.</p>}
        <p>Selections are saved on this browser for your account. Profile syncing across devices is coming with the backend integration.</p>
      </section>

      <form onSubmit={event => {
        event.preventDefault();
        run('Checking Google Calendar...', async () => {
          const range = calendarQueryRange(startDate, endDate);
          const data = await getMyBusyTimes(range.timeMin, range.timeMax, enabledIds);
          return { ...data, checkedAt: new Date().toISOString() };
        });
      }}>
        <fieldset disabled={Boolean(pending)}>
          <legend>Dates to check</legend>
          <div className="calendar-controls">
            <label>Start date<input type="date" required value={startDate}
              onChange={event => changeDate(setStartDate, event.target.value)} /></label>
            <label>End date<input type="date" required min={startDate} value={endDate}
              onChange={event => changeDate(setEndDate, event.target.value)} /></label>
            <button type="submit" disabled={!connected || !enabledIds.length}>Check busy times</button>
          </div>
        </fieldset>
        <p>Dates include both selected days. Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      </form>

      {pending && <p role="status">{pending}</p>}
      {error && <p role="alert">{error}</p>}
      {result ? <section aria-label="Calendar results" aria-live="polite">
        <h3>{result.busy.length} busy {result.busy.length === 1 ? 'block' : 'blocks'}</h3>
        <p>Checked {new Date(result.checkedAt).toLocaleTimeString()}. {result.calendarIds?.length || 1} selected calendar(s); overlapping busy times merged.</p>
        {result.busy.length ? <ul className="calendar-busy-list">
          {result.busy.map((block, index) => <li key={index}>
            <strong>Busy</strong><span>{formatTime(block.start)} to {formatTime(block.end)}</span>
          </li>)}
        </ul> : <p>No busy blocks were returned for these dates. Events marked Free do not block time.</p>}
      </section> : !pending && <p>Your busy blocks will appear here after you connect and check a date range.</p>}

      <aside>
        <h3>Try it with a real event</h3>
        <p>Choose dates containing an event marked Busy on a selected Google Calendar, then check that its time appears above. Move the event and check again to confirm the result updates.</p>
        <p>Friends and group comparisons will become available after the backend integration.</p>
      </aside>
    </section>
  );
}
