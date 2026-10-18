import React, { useEffect, useRef, useState } from 'react';
import Welcome from './pages/Welcome.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import MomentLogo from './components/MomentLogo.jsx';
import SocialApp from './pages/SocialApp.jsx';
import { themeTokens } from './lib/theme.js';
import { supabase } from './lib/supabase.js';
import { useSocialBackend } from './lib/useSocialBackend.js';
import { AvailabilityContext } from './lib/AvailabilityContext.jsx';

const currentPage = () => {
  const route = window.location.hash.slice(1);
  return /^(welcome|profile|calendar|note|people|notifications|groups|new-group|group\/[^/]+|person\/[^/]+)$/.test(route) ? route : 'welcome';
};
const blankProfile = () => ({ name: '', username: '', bio: '', interests: [], availability: 'private', showInterests: true,
  workSocial: false, note: '', noteDuration: 'week', noteExpiresAt: null });

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [theme, setTheme] = useState('social');
  const [colors, setColors] = useState({ social: '#80619a', work: '#5d795b' });
  const [profile, setProfile] = useState(blankProfile);
  const [authError, setAuthError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const authDestination = useRef(null);
  const backend = useSocialBackend();
  const live = Boolean(backend.session);
  const visiblePage = live ? (page === 'welcome' ? 'calendar' : page) : 'welcome';
  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => { setProfile(blankProfile()); }, [backend.session?.user.id]);
  useEffect(() => {
    if (backend.profile) setProfile(old => ({
      ...old,
      name: backend.profile.display_name || '',
      bio: backend.profile.bio || '',
      interests: backend.profile.interests || [],
      availability: backend.profile.availability_visibility || 'private',
      showInterests: backend.profile.show_interests ?? true,
      workSocial: backend.profile.work_social ?? false,
      username: backend.profile.username || '',
      note: backend.profile.note || '',
      noteDuration: backend.profile.noteDuration || 'week',
      noteExpiresAt: backend.profile.noteExpiresAt || null,
    }));
  }, [backend.profile]);
  useEffect(() => {
    if (!backend.ready) return;
    if (!backend.session) {
      if (page !== 'welcome') window.location.hash = 'welcome';
      return;
    }
    const destination = authDestination.current || sessionStorage.getItem('moment:auth-return');
    if (destination) {
      const nextPage = destination === 'profile' ? 'profile' : 'calendar';
      if (page !== nextPage) window.location.hash = nextPage;
      else {
        authDestination.current = null;
        sessionStorage.removeItem('moment:auth-return');
      }
    } else if (page === 'welcome') window.location.hash = 'calendar';
  }, [backend.ready, backend.session?.user.id, page]);
  async function authenticate(mode, email, password) {
    if (!supabase) throw new Error('Supabase is not configured.');
    authDestination.current = mode === 'signup' ? 'profile' : 'calendar';
    const { data, error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL('./', window.location.href).href } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) { authDestination.current = null; throw error; }
    if (!data.session) {
      authDestination.current = null;
      return 'Check your email to confirm your account, then log in.';
    }
    window.location.hash = mode === 'login' ? 'calendar' : 'profile';
    return '';
  }
  async function finishProfile() {
    if (!live) return;
    const result = await backend.perform(api => api.saveProfile(backend.session.user.id, profile));
    if (result) window.location.hash = 'calendar';
  }
  async function signOut() {
    setSigningOut(true); setAuthError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      sessionStorage.removeItem('moment:auth-return');
      window.location.hash = 'welcome';
    } catch (error) { setAuthError(error.message); }
    finally { setSigningOut(false); }
  }
  return (
    <AvailabilityContext.Provider value={live ? { session: backend.session } : null}>
    <div className={`app theme-${theme} ${visiblePage === 'calendar' || visiblePage.startsWith('group/') ? 'calendar-page' : ''}`} style={themeTokens(colors[theme])}>
      <header className="app-header">
        <a className="brand-link" href={live ? '#calendar' : '#welcome'} aria-label="Moment home"><MomentLogo /></a>
        <div className="appearance-controls">
        <label className="theme-picker">Theme <input type="color" aria-label={`${theme === 'work' ? 'Work' : 'Social'} theme and personal calendar color`} value={colors[theme]} onChange={event => setColors(previous => ({ ...previous, [theme]: event.target.value }))} /></label>
        <div className="mode-switch" aria-label="Appearance mode">
          {['social', 'work'].map(value => <button key={value} type="button" aria-pressed={theme === value} className={theme === value ? 'selected' : ''} onClick={() => {
            setTheme(value);
            if (page.startsWith('group/')) window.location.hash = 'groups';
            if (page === 'note' && value === 'work') window.location.hash = 'calendar';
          }}>{value === 'social' ? 'Social' : 'Work'}</button>)}
        </div>
        {live && <button type="button" className="text-button" disabled={signingOut} onClick={signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>}
        </div>
      </header>
      {authError && <p className="inline-notice" role="alert">{authError}</p>}
      {!backend.ready ? <main className="welcome-stage" role="status">Opening Moment…</main> : !live
        ? <Welcome theme={theme} onContinue={authenticate} />
        : visiblePage === 'profile' ? <ProfileSetup profile={profile} setProfile={setProfile} theme={theme}
        live={live} session={backend.session} error={backend.error} pending={backend.pending}
        onFinish={finishProfile} />
        : <SocialApp key={backend.session.user.id} route={visiblePage} demo={backend.state}
          people={backend.people} backend={backend}
          profile={profile} setProfile={setProfile} theme={theme} />}
      <footer className="app-footer"><span>moment © 2026</span><span>{theme === 'work' ? 'Make space for better collaboration.' : 'A little less busy. A little more us.'}</span></footer>
    </div>
    </AvailabilityContext.Provider>
  );
}
