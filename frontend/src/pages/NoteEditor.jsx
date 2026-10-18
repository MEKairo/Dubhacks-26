import React, { useState } from 'react';

export default function NoteEditor({ profile, setProfile }) {
  const [note, setNote] = useState(profile.note);
  const [duration, setDuration] = useState(profile.noteDuration);
  function save(event) {
    event.preventDefault();
    setProfile(previous => ({ ...previous, note: note.trim(), noteDuration: duration, noteExpiresAt: duration === 'forever' ? null : Date.now() + (duration === 'day' ? 1 : 7) * 86400000 }));
    window.location.hash = 'calendar';
  }
  return <section className="surface note-page"><a className="back-link" href="#calendar">← Back to notes</a><h1>A little plan to share.</h1><p className="description">Only your friends see this note on their social calendar.</p><form onSubmit={save} className="profile-fields"><label htmlFor="activity-note">I want to…</label><textarea id="activity-note" rows={4} maxLength={180} value={note} onChange={event => setNote(event.target.value)} placeholder="Go climbing with someone this week!" /><label htmlFor="note-duration">Keep it up for</label><select id="note-duration" value={duration} onChange={event => setDuration(event.target.value)}><option value="day">One day</option><option value="week">One week</option><option value="forever">Until I remove it</option></select><p className="privacy-note">Clear the note and save to remove it.</p><div className="panel-actions"><a className="text-button" href="#calendar">Cancel</a><button className="primary-button" type="submit">Save note →</button></div></form></section>;
}
