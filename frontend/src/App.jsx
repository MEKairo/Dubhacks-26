import React, { useEffect, useState } from 'react';
import Welcome from './pages/Welcome.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import MomentLogo from './components/MomentLogo.jsx';
import SocialApp from './pages/SocialApp.jsx';
import { createDemoState } from './data/demo.js';
import { themeTokens } from './lib/theme.js';
import { supabase } from './lib/supabase.js';
import { useSocialBackend } from './lib/useSocialBackend.js';
import { AvailabilityContext } from './lib/AvailabilityContext.jsx';

const currentPage = () => {
  const route = window.location.hash.slice(1);
  return /^(welcome|profile|calendar|note|people|notifications|groups|new-group|group\/[^/]+|person\/[^/]+)$/.test(route) ? route : 'welcome';
};
const blankProfile = () => ({ name: '', bio: '', interests: [], availability: 'groups', showInterests: true,
  workSocial: false, note: '', noteDuration: 'week', noteExpiresAt: null });

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [theme, setTheme] = useState('social');
  const [colors, setColors] = useState({ social: '#80619a', work: '#5d795b' });
  const [profile, setProfile] = useState(blankProfile);
  const [demo, setDemo] = useState(createDemoState);
  const backend = useSocialBackend();
  const live = Boolean(backend.session);
  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => { setProfile(blankProfile()); }, [backend.session?.user.id]);
  useEffect(() => {
    if (backend.profile) setProfile(old => ({ ...old, name: backend.profile.display_name || '' }));
  }, [backend.profile]);
  useEffect(() => {
    if (backend.session && sessionStorage.getItem('moment:auth-return')) {
      window.location.hash = sessionStorage.getItem('moment:auth-return');
      sessionStorage.removeItem('moment:auth-return');
    }
  }, [backend.session?.user.id]);
  async function authenticate(mode, email, password) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) return 'Check your email to confirm your account, then log in.';
    window.location.hash = mode === 'login' ? 'calendar' : 'profile';
    return '';
  }
  async function finishProfile() {
    if (!live) { window.location.hash = 'calendar'; return; }
    const result = await backend.perform(api => api.saveProfile(backend.session.user.id, profile));
    if (result) window.location.hash = 'calendar';
  }
  return (
    <AvailabilityContext.Provider value={live ? { session: backend.session } : null}>
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
      {page === 'profile' ? <ProfileSetup profile={profile} setProfile={setProfile} theme={theme}
        live={live} session={backend.session} error={backend.error} pending={backend.pending}
        onFinish={finishProfile} /> : page === 'welcome'
        ? <Welcome theme={theme} onContinue={authenticate} onExplore={mode => { window.location.hash = mode === 'login' ? 'calendar' : 'profile'; }} />
        : <SocialApp route={page} demo={live ? backend.state : demo} setDemo={setDemo}
          people={live ? backend.people : undefined} backend={live ? backend : null}
          profile={profile} setProfile={setProfile} theme={theme} />}
      <footer className="app-footer"><span>moment © 2026</span><span>{theme === 'work' ? 'Make space for better collaboration.' : 'A little less busy. A little more us.'}</span></footer>
    </div>
    </AvailabilityContext.Provider>
  );
}
