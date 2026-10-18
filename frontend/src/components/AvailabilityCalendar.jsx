import React, { useState } from 'react';
import { addDays, freeCount, startOfWeek } from '../lib/availability.js';
import { withinTimeline, timelineSummary } from '../lib/workPolicy.js';
const demoToday = new Date(2026, 9, 17, 12);
const shortDate = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const timeLabel = hour => `${Math.floor(hour) % 12 || 12}:${Number.isInteger(hour) ? '00' : '30'} ${hour < 12 ? 'AM' : 'PM'}`;

export default function AvailabilityCalendar({ memberIds = ['me'], color = 'var(--personal-color, #80619a)', title = 'My calendar', timeline, onInspect }) {
  const [zoom, setZoom] = useState(100);
  const scrollRef = React.useRef(null);
  const [view, setView] = useState('week');
  const [date, setDate] = useState(demoToday);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  React.useEffect(() => {
    if (view === 'month' || !scrollRef.current) return;
    const index = timeline ? 0 : 16;
    scrollRef.current.scrollTop = index * 24 * zoom / 100;
  }, [view, timeline]);
  const weekStart = startOfWeek(date);
  const days = (view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))).filter(day => !timeline || timeline.includeWeekends || ![0, 6].includes(day.getDay()));
  const hours = Array.from({ length: 48 }, (_, i) => i / 2).filter(hour => !timeline || hour >= timeline.startHour && hour < timeline.endHour);
  const numMembers = memberIds.length;
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));
  const inspected = hovered || selected;
  function inspect(slot, pin = false) {
    if (pin) setSelected(slot); else setHovered(slot);
    onInspect?.(slot || selected);
  }
  function reset() { setSelected(null); setHovered(null); onInspect?.(null); }
  function navigate(direction) {
    if (view === 'month') setDate(new Date(date.getFullYear(), date.getMonth() + direction, 1, 12));
    else setDate(addDays(date, direction * (view === 'week' ? 7 : 1)));
    reset();
  }
  const range = view === 'month' ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : view === 'day' ? shortDate(date) : `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`;
  return <section className="availability-calendar" style={{ '--calendar-color': color, '--slots': hours.length, '--slot-height': `${24 * zoom / 100}px` }} aria-label={title}>
    <div className="calendar-top"><div><h2>{title}</h2><p>{range} {view !== 'month' && <span>· {date.getFullYear()}</span>}</p></div><div className="view-switch" aria-label="Calendar view">{['day','week','month'].map(value => <button key={value} className={view === value ? 'active' : ''} aria-pressed={view === value} onClick={() => { setView(value); reset(); }}>{value}</button>)}</div></div>
    <div className="calendar-navigation"><div><button className="secondary-button" aria-label="Previous period" onClick={() => navigate(-1)}>←</button><button className="secondary-button" onClick={() => { setDate(demoToday); reset(); }}>Demo today</button><button className="secondary-button" aria-label="Next period" onClick={() => navigate(1)}>→</button></div><span>Pacific time · sample availability</span></div>
    {timeline && <p className="timeline-summary">Shared window: {timelineSummary(timeline)}. Outside this window is not shared.</p>}
    {view === 'month' ? <><p className="privacy-note">Select a date for half-hour availability.</p><div className="month-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <div className="month-label" key={day}>{day}</div>)}{monthDays.map(day => {
      const allowed = hours.some(hour => withinTimeline(day, hour, timeline));
      return <button disabled={!allowed} key={day.toISOString()} className={day.getMonth() === date.getMonth() ? '' : 'outside-month'} onClick={() => { setDate(day); setView('day'); reset(); }} aria-label={`${shortDate(day)}${allowed ? '' : ': outside shared window'}`}><span>{day.getDate()}</span>{allowed && <i style={{ background: color, opacity: numMembers ? hours.reduce((sum, hour) => sum + freeCount(memberIds, day, hour), 0) / (hours.length * numMembers) * .8 : 0 }} />}</button>;
    })}</div></> : days.length ? <>
      <div className="calendar-scroll" ref={scrollRef} tabIndex={0} aria-label="Scrollable calendar times" onMouseLeave={() => inspect(null)}><div className={`hour-grid ${view === 'day' ? 'day-grid' : ''}`} style={{ '--days': days.length }}>
        <div className="hour-grid-corner">TIME</div>{days.map(day => <div className="day-heading" key={day.toISOString()}><span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{day.getDate()}</b></div>)}
        {hours.map(hour => <React.Fragment key={hour}><div className="hour-label">{Number.isInteger(hour) ? `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}` : ''}</div>{days.map(day => {
          const count = freeCount(memberIds, day, hour);
          const label = `${shortDate(day)}, ${timeLabel(hour)}: ${count} of ${numMembers} free`;
          const slot = { day, hour };
          return <button key={day.toISOString()} disabled={!numMembers} className={`availability-cell ${Number.isInteger(hour) ? 'on-hour' : ''}`} aria-label={label} title={label} onMouseEnter={() => inspect(slot)} onFocus={() => inspect(slot)} onBlur={() => inspect(null)} onClick={() => inspect(slot, true)}><span style={{ background: color, opacity: numMembers ? count / numMembers * .8 : 0 }} />{view === 'day' && <small>{numMembers ? `${count}/${numMembers} free` : ''}</small>}</button>;
        })}</React.Fragment>)}
      </div></div>
      <div className="calendar-legend"><span>No one free</span><i style={{ background: `linear-gradient(to right, transparent, ${color})` }} /><span>Everyone free</span><span className="slot-note">30-minute slots</span></div>
      <p className="slot-detail" role="status">{!numMembers ? 'Select at least one active member to see availability.' : inspected ? `${shortDate(inspected.day)} at ${timeLabel(inspected.hour)} · ${freeCount(memberIds, inspected.day, inspected.hour)} of ${numMembers} selected people free.` : 'Hover, focus, or tap a time to inspect availability.'}</p>
      <label className="calendar-zoom">Zoom <input type="range" min="75" max="200" step="5" value={zoom} aria-label="Calendar time-block zoom" aria-valuetext={`${zoom} percent`} onChange={event => {
        const next = Number(event.target.value);
        const scroll = scrollRef.current;
        const position = scroll ? scroll.scrollTop / (24 * zoom / 100) : 0;
        setZoom(next);
        if (scroll) requestAnimationFrame(() => { scroll.scrollTop = position * 24 * next / 100; });
      }} /><output>{zoom}%</output></label>
    </> : <p className="outside-window">This day is outside the group’s shared window. Choose a weekday or switch to week view.</p>}
  </section>;
}
