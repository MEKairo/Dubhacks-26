import React, { useState } from 'react';
import { connectGoogleCalendar } from '../lib/googleCalendar.js';

const interests = ['Climbing', 'Coffee', 'Gym', 'Reading', 'Gaming', 'Hiking', 'Art', 'Food', 'Music', 'Study sessions'];

export default function ProfileSetup({ profile, setProfile, theme, onFinish, live, session, error, pending }) {
  const [step, setStep] = useState(1);
  const [notice, setNotice] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [customInterest, setCustomInterest] = useState('');
  const work = theme === 'work';
  const update = (key, value) => setProfile(previous => ({ ...previous, [key]: value }));
  function toggleInterest(interest) {
    update('interests', profile.interests.includes(interest) ? profile.interests.filter(item => item !== interest) : [...profile.interests, interest]);
  }
  function addInterest(event) {
    event.preventDefault();
    const value = customInterest.trim();
    if (value && !profile.interests.some(item => item.toLowerCase() === value.toLowerCase())) update('interests', [...profile.interests, value]);
    setCustomInterest('');
  }
  const choices = [...new Set([...interests, ...profile.interests])];

  return (
    <main className="profile-stage">
      <div className="profile-top-links"><a href="#calendar" className="back-link">← My calendar</a></div>
      <div className="profile-heading"><p className="eyebrow">A LITTLE INTRODUCTION</p><h1>Make yourself at home.</h1><p className="description">Your time, your interests, your kind of connection.</p></div>
      <div className="setup-layout">
        <aside className="setup-sidebar">
          <nav aria-label="Profile setup steps">{['Your calendar', 'A little about you', 'Your sharing choices'].map((label, i) => <button key={label} type="button" aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'current-step' : ''} onClick={() => { setStep(i + 1); setNotice(''); }}><span>{i + 1}</span>{label}</button>)}</nav>
          <div className="profile-preview"><span className="avatar">{profile.name.trim().slice(0,1).toUpperCase() || 'm'}</span><h2>{profile.name || 'Your name here'}</h2><p>{profile.bio || 'A little space for you.'}</p><div className="preview-tags">{profile.interests.map(interest => <span key={interest}>{interest}</span>)}</div><small>Only share what feels right.</small></div>
        </aside>
        <section className="setup-panel" aria-labelledby="step-title">
          <p className="eyebrow">STEP {step} OF 3</p>
          <h2 id="step-title" tabIndex={-1}>{step === 1 ? 'Start with your calendar.' : step === 2 ? 'More than a busy schedule.' : 'You choose what to share.'}</h2>
          {step === 1 && <>
            <p className="description">Keep your availability in one place. Less checking, more making plans.</p>
            <div className="provider-card"><span className="provider-icon" aria-hidden="true">31</span><div><h3>Google Calendar</h3><p>Your events stay in your calendar.</p></div><button className="secondary-button" type="button" disabled={connecting} aria-busy={connecting} onClick={async () => {
              if (!live) { setNotice('Sign in before connecting Google Calendar. Open Welcome screen above and log in; Explore is a preview.'); return; }
              setConnecting(true);
              setNotice('Opening Google sign-in in this tab…');
              try {
                sessionStorage.setItem('moment:auth-return', 'profile');
                await connectGoogleCalendar();
              } catch (error) { setNotice(error.message); }
              finally { setConnecting(false); }
            }}>{connecting ? 'Connecting…' : session?.provider_token ? 'Reconnect' : 'Connect'} <span aria-hidden="true">↗</span></button></div>
            <p className="privacy-note">You’ll choose what others can see. Availability only is the default; event titles and details stay private.</p>
            <div className="coming-soon"><span>Apple Calendar & other calendars</span><span className="badge">Coming later</span></div>
            <p className="inline-notice" role="status">{notice || error || (session?.provider_token ? 'Google Calendar connected. Availability is loaded on your calendar.' : 'Connect Google to read busy times only.')}</p>
            <div className="panel-actions"><button className="text-button" type="button" onClick={() => setStep(2)}>Skip for now</button><button className="primary-button" type="button" onClick={() => setStep(2)}>Make it yours →</button></div>
          </>}
          {step === 2 && <>
            <p className="description">Give your people a little glimpse of what makes you, you.</p>
            <div className="profile-fields"><label htmlFor="display-name">What should we call you?</label><input id="display-name" placeholder="Your name" maxLength={60} value={profile.name} onChange={event => update('name', event.target.value)} /><label htmlFor="username">Your unique username</label><input id="username" name="username" placeholder="e.g. sam.p" maxLength={30} value={profile.username || ''} onChange={event => update('username', event.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} /><label htmlFor="bio">A little about you <span className="optional">(optional)</span></label><textarea id="bio" rows={2} maxLength={180} placeholder="Always up for coffee and a very long walk." value={profile.bio} onChange={event => update('bio', event.target.value)} /></div>
            <h3 className="interest-title">What would you like to make time for?</h3><div className="interest-chips">{choices.map(interest => <button key={interest} className={profile.interests.includes(interest) ? 'chosen' : ''} aria-pressed={profile.interests.includes(interest)} type="button" onClick={() => toggleInterest(interest)}>{profile.interests.includes(interest) ? '✓ ' : '+ '}{interest}</button>)}</div>
            <form className="custom-interest" onSubmit={addInterest}><label className="sr-only" htmlFor="custom-interest">Add your own interest</label><input id="custom-interest" placeholder="Something else?" maxLength={35} value={customInterest} onChange={event => setCustomInterest(event.target.value)} /><button className="secondary-button" type="submit" disabled={!customInterest.trim()}>Add</button></form>
            <div className="panel-actions"><button className="text-button" type="button" onClick={() => setStep(1)}>← Calendar</button><button className="primary-button" type="button" onClick={() => setStep(3)}>Sharing choices →</button></div>
          </>}
          {step === 3 && <>
            <p className="description">A shared moment shouldn’t mean sharing everything.</p>
            <fieldset className="sharing-options"><legend>Who can see when you’re free?</legend>{[['groups','People in my groups'],['friends','Friends only'],['private','Only me, for now']].map(([value, label]) => <label key={value}><input type="radio" name="availability" checked={profile.availability === value} onChange={() => update('availability', value)} /><span>{label}</span></label>)}</fieldset>
            <p className="privacy-note">Availability only. Event names, locations, and notes stay private.</p>
            <label className="toggle-row"><span><strong>Share my interests</strong><small>Let friends discover things you could do together.</small></span><input type="checkbox" checked={profile.showInterests} onChange={event => update('showInterests', event.target.checked)} /></label>
            <label className="toggle-row"><span><strong>Social connection at work</strong><small>{work ? 'Opt in to share interests with your work groups.' : 'Share interests with work groups, too. Entirely optional.'}</small></span><input type="checkbox" checked={profile.workSocial} onChange={event => update('workSocial', event.target.checked)} /></label>
            <p className="inline-notice" role="status">{error || 'Your sharing choices are saved to your profile when signed in.'}</p>
            <div className="panel-actions"><button className="text-button" type="button" onClick={() => setStep(2)}>← About you</button><button className="primary-button" type="button" disabled={pending} onClick={onFinish}>Open my calendar →</button></div>
          </>}
        </section>
      </div>
      <p className="profile-footnote">Profile details and sharing choices save to your account when signed in.</p>
    </main>
  );
}
