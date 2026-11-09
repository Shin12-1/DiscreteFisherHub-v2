import { getLocalStorageAdapter, useLocalStorage, useStorageAdapter } from './storage.js';
import { SupabaseAdapter } from './supabase-adapter.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../config.js').catch(async (error) => {
  console.warn('Optional js/config.js is unavailable; using guest-mode defaults.', error);
  return import('../config.example.js');
});

let client = null;
let currentSession = null;
const placeholder = (value) => !value || value.includes('PASTE_YOUR_');

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL?.startsWith('https://') && !placeholder(SUPABASE_ANON_KEY));
}

async function loadBrowserClient() {
  if (window.supabase?.createClient) return;
  const source = location.pathname.includes('/pages/') ? '../js/vendor/supabase.js' : 'js/vendor/supabase.js';
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source; script.onload = resolve; script.onerror = () => reject(new Error('The local Supabase client could not load.'));
    document.head.append(script);
  });
  if (!window.supabase?.createClient) throw new Error('The local Supabase client is unavailable.');
}

function validateCredentials({ email, password, nickname }, needsNickname = false) {
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new Error('Enter a valid email address.');
  if ((password || '').length < 8) throw new Error('Use a password with at least 8 characters.');
  if (needsNickname && !/^[A-Za-z0-9 _.-]{3,32}$/.test(nickname || '')) throw new Error('Use a 3–32 character nickname with letters, numbers, spaces, dots, hyphens, or underscores.');
}

async function activateSession(session) {
  if (!session?.user || !client) { useLocalStorage(); currentSession = null; return null; }
  const local = getLocalStorageAdapter();
  const localState = await local.get('learner-state', {});
  const remote = new SupabaseAdapter(client, session.user, local);
  const serverState = await remote.get('learner-state', localState);
  await remote.set('learner-state', { ...localState, nickname:serverState.nickname, completedLessons:[...new Set([...(serverState.completedLessons || []), ...(localState.completedLessons || [])])] });
  useStorageAdapter(remote);
  currentSession = session;
  return session;
}

export async function initialiseAuth() {
  if (!isSupabaseConfigured()) { useLocalStorage(); return null; }
  if (!client) {
    await loadBrowserClient();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  }
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return activateSession(data.session);
}

export async function signUp(credentials) {
  if (!isSupabaseConfigured()) throw new Error('Add your Supabase anon key to js/config.js before creating an account.');
  validateCredentials(credentials, true);
  const { data, error } = await client.auth.signUp({ email:credentials.email.trim(), password:credentials.password, options:{ data:{ nickname:credentials.nickname.trim() } } });
  if (error) throw error;
  if (data.session) await activateSession(data.session);
  return { needsEmailConfirmation:!data.session };
}

export async function signIn(credentials) {
  if (!isSupabaseConfigured()) throw new Error('Add your Supabase anon key to js/config.js before signing in.');
  validateCredentials(credentials);
  const { data, error } = await client.auth.signInWithPassword({ email:credentials.email.trim(), password:credentials.password });
  if (error) throw error;
  await activateSession(data.session);
  return data.session;
}

export async function signOut() {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  useLocalStorage();
  currentSession = null;
}

export function getCurrentUser() { return currentSession?.user || null; }
export async function getLeaderboard() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client.from('leaderboard').select('nickname, xp');
  if (error) throw error;
  return data || [];
}
