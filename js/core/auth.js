import { getLocalStorageAdapter, useLocalStorage, useStorageAdapter } from './storage.js';
import { SupabaseAdapter } from './supabase-adapter.js';
import { listQuizAttempts, saveQuizAttempt } from './quiz-history.mjs';

const config = await import('../config.js').catch(async (error) => {
  console.warn('Optional js/config.js is unavailable; using guest-mode defaults.', error);
  return import('../config.example.js');
});
const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = config.SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_ANON_KEY;

let client = null;
let currentSession = null;
const placeholder = (value) => !value || value.includes('PASTE_YOUR_');

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL?.startsWith('https://') && !placeholder(SUPABASE_PUBLISHABLE_KEY));
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

function explainAuthError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (text.includes('over_email_send_rate_limit') || text.includes('rate limit')) return 'Too many emails were requested. Wait a few minutes (or raise the limit in Supabase Auth > Rate Limits) and try again.';
  if (text.includes('error sending') || text.includes('smtp')) return 'Supabase could not send the email through your SMTP provider. Check the SMTP username, password and verified sender in Supabase and turboSMTP.';
  if (text.includes('database error saving new user')) return 'That nickname is already taken. Choose a different nickname.';
  if (text.includes('already registered')) return 'This email is already registered. Log in instead.';
  return error?.message || 'We could not complete that request. Please try again.';
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
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  }
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return activateSession(data.session);
}

export async function signUp(credentials) {
  if (!isSupabaseConfigured()) throw new Error('Configure your Supabase URL and publishable key before creating an account.');
  validateCredentials(credentials, true);
  const { data, error } = await client.auth.signUp({
    email:credentials.email.trim(),
    password:credentials.password,
    options:{
      data:{ nickname:credentials.nickname.trim() },
      emailRedirectTo:new URL('/', location.origin).href
    }
  });
  if (error) throw new Error(explainAuthError(error));
  // With email confirmation on, Supabase hides duplicates: it returns a fake user with no identities and sends NO email.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('This email is already registered. Log in instead, or use "Resend confirmation email" if you never confirmed it.');
  }
  if (data.session) await activateSession(data.session);
  return { needsEmailConfirmation:!data.session };
}

export async function signIn(credentials) {
  if (!isSupabaseConfigured()) throw new Error('Configure your Supabase URL and publishable key before signing in.');
  validateCredentials(credentials);
  const { data, error } = await client.auth.signInWithPassword({ email:credentials.email.trim(), password:credentials.password });
  if (error) throw error;
  await activateSession(data.session);
  return data.session;
}

export async function resendSignupConfirmation(email) {
  if (!client) throw new Error('Supabase is not connected. Reload the page and try again.');
  const { error } = await client.auth.resend({
    type:'signup',
    email:email.trim(),
    options:{ emailRedirectTo:new URL('/', location.origin).href }
  });
  if (error) throw new Error(explainAuthError(error));
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

export async function getQuizAttempts() {
  return listQuizAttempts({
    localAdapter:getLocalStorageAdapter(),
    client:currentSession ? client : null,
    userId:currentSession?.user.id || null
  });
}

export async function recordQuizAttempt(attempt) {
  return saveQuizAttempt({
    localAdapter:getLocalStorageAdapter(),
    client:currentSession ? client : null,
    userId:currentSession?.user.id || null,
    attempt
  });
}