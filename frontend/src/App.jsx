import React, { useEffect, useState } from 'react';
import Welcome from './pages/Welcome.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import MomentLogo from './components/MomentLogo.jsx';
import SocialApp from './pages/SocialApp.jsx';
import { createDemoState } from './data/demo.js';
import { themeTokens } from './lib/theme.js';

const currentPage = () => {
  const route = window.location.hash.slice(1);
  return /^(welcome|profile|calendar|note|people|notifications|groups|new-group|group\/[^/]+|person\/[^/]+)$/.test(route) ? route : 'welcome';
};

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [theme, setTheme] = useState('social');
  const [colors, setColors] = useState({ social: '#80619a', work: '#5d795b' });
  const [profile, setProfile] = useState({ name: '', bio: '', interests: [], availability: 'groups', showInterests: true, workSocial: false, note: '', noteDuration: 'week', noteExpiresAt: null });
  const [demo, setDemo] = useState(createDemoState);
  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  return (
    <div className={`app theme-${theme} ${page === 'calendar' || page.startsWith('group/') ? 'calendar-page' : ''}`} style={themeTokens(colors[theme])}>
      <header className="app-header">
        <a className="brand-link" href={page === 'welcome' ? '#welcome' : '#calendar'} aria-label="Moment home"><MomentLogo /></a>
        <div className="appearance-controls">
        <label className="theme-picker">Theme <input type="color" aria-label={`${theme === 'work' ? 'Work' : 'Social'} theme and personal calendar color`} value={colors[theme]} onChange={event => setColors(previous => ({ ...previous, [theme]: event.target.value }))} /></label>
        <div className="mode-switch" aria-label="Appearance mode">
          {['social', 'work'].map(value => <button key={value} type="button" aria-pressed={theme === value} className={theme === value ? 'selected' : ''} onClick={() => {
            setTheme(value);
            if (page.startsWith('group/')) window.location.hash = 'groups';
            if (page === 'note' && value === 'work') window.location.hash = 'calendar';
          }}>{value === 'social' ? 'Social' : 'Work'}</button>)}
        </div>
        </div>
      </header>
      {page === 'profile' ? <ProfileSetup profile={profile} setProfile={setProfile} theme={theme} onFinish={() => { window.location.hash = 'calendar'; }} /> : page === 'welcome' ? <Welcome theme={theme} onContinue={mode => { window.location.hash = mode === 'login' ? 'calendar' : 'profile'; }} /> : <SocialApp route={page} demo={demo} setDemo={setDemo} profile={profile} setProfile={setProfile} theme={theme} />}
      <footer className="app-footer"><span>moment © 2026</span><span>{theme === 'work' ? 'Make space for better collaboration.' : 'A little less busy. A little more us.'}</span></footer>
    </div>
  );
}
