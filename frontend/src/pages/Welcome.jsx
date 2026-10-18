import React, { useEffect, useRef, useState } from 'react';
import MomentLogo from '../components/MomentLogo.jsx';
import { pacificToday } from '../lib/dates.js';
import { addDays, startOfWeek } from '../lib/availability.js';

export default function Welcome({ theme, onContinue, onExplore }) {
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('signup');
  const emailRef = useRef(null);
  const work = theme === 'work';
  const today = pacificToday();
  const weekStart = startOfWeek(today);
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => emailRef.current?.focus(), 900);
    return () => clearTimeout(timer);
  }, [opened]);

  return (
    <main className="welcome-stage">
      <section className="calendar-window" aria-label="Moment welcome calendar">
        <div className="window-bar"><span>▦ &nbsp; moment</span><div className="window-controls" aria-hidden="true"><span className="minimize-control"><i /></span><span>□</span><span>×</span></div></div>
        <div className={`calendar-body ${opened ? 'is-open' : ''}`}>
          <div className="binder-rings" aria-hidden="true">{[0,1,2,3,4,5].map(n => <span key={n} />)}</div>
          <div className="paper-stub" aria-hidden="true" />
          <div className="auth-sheet" inert={!opened ? true : undefined} aria-hidden={!opened}>
            <p className="eyebrow">MAKE A LITTLE ROOM</p>
            <h1>{mode === 'login' ? 'Welcome back.' : 'Your people. Your moment.'}</h1>
            <p className="description">{work ? 'Bring your calendars together. Find time to do great work.' : 'Good things happen when we make time for each other.'}</p>
            <div className="auth-tabs" aria-label="Account options">{['signup', 'login'].map(value => <button key={value} type="button" className={mode === value ? 'active' : ''} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'signup' ? 'Sign up' : 'Log in'}</button>)}</div>
            <form onSubmit={async event => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              setPending(true); setNotice('');
              try { setNotice(await onContinue(mode, values.get('email'), values.get('password')) || ''); }
              catch (error) { setNotice(error.message); }
              finally { setPending(false); }
            }}>
              <label htmlFor="email">Email address</label><input ref={emailRef} id="email" name="email" type="email" placeholder="you@somewhere.com" autoComplete="email" required />
              <label htmlFor="password">Password</label><input id="password" name="password" type="password" placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />
              <button className="primary-button" type="submit" disabled={pending}>{mode === 'signup' ? 'Create account & set up profile' : 'Open my calendar'} <span aria-hidden="true">→</span></button>
            </form>
            <p className="preview-note" role="status">{notice || (pending ? 'Signing in…' : 'Sign in securely, or explore the frontend preview below.')}</p>
            <button className="text-button" type="button" onClick={() => onExplore(mode)}>{mode === 'login' ? 'Explore the calendar →' : 'Explore profile setup →'}</button>
            <button className="text-button back-cover" type="button" onClick={() => setOpened(false)}>← Back to the cover</button>
          </div>
          <div className="calendar-cover" aria-hidden={opened} inert={opened ? true : undefined}>
            <div className="cover-topline"><span>MAKE TIME FOR WHAT MATTERS</span><span>EST. 2026</span></div>
            <div className="cover-center">
              <p className="eyebrow">{work ? 'LESS BACK-AND-FORTH. MORE TIME TOGETHER.' : 'LESS “WE SHOULD HANG OUT.”'}</p>
              <h1><MomentLogo large /></h1>
              <p className="cover-description">{work ? <>Shared schedules. Better teamwork.<br />Find the moment that works for everyone.</> : <>More “see you there.”<br />Make room for your favorite people.</>}</p>
              <div className="tiny-week" aria-label="This week">{['M','T','W','T','F','S','S'].map((day, i) => {
                const date = addDays(weekStart, i);
                const isToday = date.toDateString() === today.toDateString();
                return <span key={i} className={isToday ? 'marked-day' : ''} aria-current={isToday ? 'date' : undefined} aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ', today' : ''}`}>{day}<b>{date.getDate()}</b></span>;
              })}</div>
              <button className="primary-button open-button" type="button" onClick={() => setOpened(true)}>Let’s find the time.</button>
            </div>
            <div className="cover-rule" aria-hidden="true" />
          </div>
        </div>
        <div className="window-footer"><span><i /> {work ? 'Availability, without the back-and-forth.' : 'More connection. Less coordination.'}</span><span>moment</span></div>
      </section>
    </main>
  );
}
