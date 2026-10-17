import React, { useEffect, useState } from 'react';
import { connectGoogleCalendar, getMyBusyTimes, supabase } from '../lib/googleCalendar.js';

export default function GoogleCalendarConnect() {
  const [session, setSession] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setResult(null);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function run(action) {
    setPending(true);
    setError('');
    setResult(null);
    try { await action(); } catch (e) { setError(e.message); } finally { setPending(false); }
  }
  return (
    <section aria-label="Google Calendar connection">
      <h2>Find time together</h2>
      <p>Connect Google Calendar to check busy times without sharing event details.</p>
      {!supabase && <p>Add your Supabase project settings to enable the connection.</p>}
      <button disabled={pending || !supabase} onClick={() => run(connectGoogleCalendar)}>
        {session ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
      </button>
      {session && <button disabled={pending} onClick={() => run(async () => {
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 86400000);
        setResult(await getMyBusyTimes(start.toISOString(), end.toISOString()));
      })}>Check my next 7 days</button>}
      {session && <button disabled={pending} onClick={() => run(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setResult(null);
      })}>Sign out</button>}
      {pending && <p role="status">Connecting…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <div role="status">
        <p>{result.busy.length} busy blocks in the next 7 days (primary calendar).</p>
        <ul>{result.busy.map((block, i) => <li key={i}>
          {new Date(block.start).toLocaleString()} – {new Date(block.end).toLocaleString()}
        </li>)}</ul>
      </div>}
    </section>
  );
}
