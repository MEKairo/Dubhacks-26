import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { emptySocial, socialBackend } from './socialBackend.mjs';

const api = supabase ? socialBackend(supabase) : null;
export function useSocialBackend() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(emptySocial);
  const [people, setPeople] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const current = useRef(null);
  const revision = useRef(0);
  const loadRevision = useRef(0);
  const refresh = useCallback(async () => {
    if (!current.current || !api) return;
    const version = revision.current;
    const load = ++loadRevision.current;
    const next = await api.load(current.current);
    if (version !== revision.current || load !== loadRevision.current) return;
    setState(next.social);
    setPeople(old => [...next.people, ...old.filter(p => !next.people.some(n => n.id === p.id))]);
    setProfile(next.profile);
  }, []);
  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextId = next?.user.id || null;
      if (nextId !== current.current) {
        revision.current++;
        current.current = nextId;
        setState(emptySocial()); setPeople([]); setProfile(null); setError(''); setPending(false);
      }
      setSession(next); setReady(true);
    });
    return () => { revision.current++; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    setPending(true);
    refresh().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [session?.user.id, refresh]);
  async function perform(action) {
    if (!current.current || !api) { setError('Sign in to use this feature.'); return null; }
    const version = revision.current;
    setPending(true); setError('');
    try {
      const result = await action(api);
      if (version !== revision.current) return null;
      try { await refresh(); }
      catch (error) { setError('Saved, but the view could not refresh. Reload before retrying: ' + error.message); }
      return { data: result };
    } catch (e) {
      if (version === revision.current) setError(e.message);
      return null;
    } finally { if (version === revision.current) setPending(false); }
  }
  async function search(username) {
    if (!api || !current.current) throw new Error('Sign in to find people.');
    const version = revision.current;
    const person = await api.search(username);
    if (version !== revision.current) return null;
    if (person && person.id !== current.current) setPeople(old => [...old.filter(p => p.id !== person.id), person]);
    return person?.id === current.current ? null : person;
  }
  return { session, ready, state, people, profile, error, pending, perform, search, refresh };
}
