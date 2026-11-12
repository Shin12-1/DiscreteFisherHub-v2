import { getLocalStorageAdapter, useLocalStorage, useStorageAdapter } from './storage.js';
import { SupabaseAdapter } from './supabase-adapter.js';
import { listQuizAttempts, saveQuizAttempt } from './quiz-history.mjs';
import { validateAuthFields } from './auth-validation.mjs';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

let client = null;
let clientPromise = null;
let currentSession = null;
const placeholder = (value) => !value || value.includes('PASTE_YOUR_');

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL?.startsWith('https://') && !placeholder(SUPABASE_PUBLISHABLE_KEY));
}

const CLIENT_LOAD_TIMEOUT_MS = 10000;

async function loadBrowserClient() {
  if (window.supabase?.createClient) return;
  const source = location.pathname.includes('/pages/') ? '../js/vendor/supabase.js' : 'js/vendor/supabase.js';
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('The Supabase client took too long to load. Check your connection.')), CLIENT_LOAD_TIMEOUT_MS);
    script.src = source;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('The local Supabase client could not load.')); };
    document.head.append(script);
  });
  if (!window.supabase?.createClient) throw new Error('The local Supabase client is unavailable.');
}

/** Load the (large) Supabase client only when something actually needs it. */
async function ensureClient() {
  if (client) return client;
  if (!isSupabaseConfigured()) throw new Error('Configure your Supabase URL and publishable key first.');
  clientPromise ??= (async () => {
    await loadBrowserClient();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  })().catch((error) => { clientPromise = null; throw error; });
  return clientPromise;
}

// A guest has no saved session and is not returning from a confirmation email, so the
// 220 KB client can wait until they sign in or open the leaderboard.
function mayHaveSession() {
  try {
    const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    if (localStorage.getItem(key)) return true;
  } catch (error) {
    console.warn('Could not check for a saved session.', error);
  }
  return /[#?&](access_token|refresh_token|code|error|error_code|error_description)=/.test(`${location.hash}${location.search}`);
}

function explainAuthError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (text.includes('over_email_send_rate_limit') || text.includes('rate limit')) return 'Too many emails were requested. Wait a few minutes (or raise the limit in Supabase Auth > Rate Limits) and try again.';
  if (text.includes('error sending') || text.includes('smtp')) return 'Supabase could not send the email through your SMTP provider. Check the SMTP username, password and verified sender in Supabase and turboSMTP.';
  if (text.includes('database error saving new user')) return 'That nickname is already taken. Choose a different nickname.';
  if (text.includes('already registered')) return 'This email is already registered. Log in instead.';
  if (text.includes('email not confirmed') || text.includes('email_not_confirmed')) return 'Confirm your email first. Check your inbox and spam folder, or use "Resend confirmation email" below.';
  if (text.includes('invalid login credentials') || text.includes('invalid_credentials')) return 'That email and password do not match. Check them and try again.';
  return error?.message || 'We could not complete that request. Please try again.';
}

function assertValid(credentials, mode) {
  const [firstError] = Object.values(validateAuthFields(credentials, mode));
  if (firstError) throw new Error(firstError);
}

async function activateSession(session) {
  if (!session?.user || !client) { useLocalStorage(); currentSession = null; return null; }
  const local = getLocalStorageAdapter();
  const localState = await local.get('learner-state', {});
  const remote = new SupabaseAdapter(client, session.user, local);
  const serverState = await remote.get('learner-state', localState);
  await remote.set('learner-state', { ...localState, nickname: serverState.nickname, completedLessons: [...new Set([...(serverState.completedLessons || []), ...(localState.completedLessons || [])])] });
  useStorageAdapter(remote);
  currentSession = session;
  return session;
}

export async function initialiseAuth() {
  if (!isSupabaseConfigured() || !mayHaveSession()) { useLocalStorage(); return null; }
  const supabase = await ensureClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return activateSession(data.session);
}

export async function signUp(credentials) {
  assertValid(credentials, 'signup');
  const supabase = await ensureClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email.trim(),
    password: credentials.password,
    options: {
      data: { nickname: credentials.nickname.trim() },
      emailRedirectTo: new URL('/', location.origin).href
    }
  });
  if (error) throw new Error(explainAuthError(error));
  // With email confirmation on, Supabase hides duplicates: it returns a fake user with no identities and sends NO email.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('This email is already registered. Log in instead, or use "Resend confirmation email" if you never confirmed it.');
  }
  if (data.session) await activateSession(data.session);
  return { needsEmailConfirmation: !data.session };
}

export async function signIn(credentials) {
  assertValid(credentials, 'login');
  const supabase = await ensureClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: credentials.email.trim(), password: credentials.password });
  if (error) throw new Error(explainAuthError(error));
  await activateSession(data.session);
  return data.session;
}

export async function resendSignupConfirmation(email) {
  const supabase = await ensureClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: new URL('/', location.origin).href }
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
  const supabase = await ensureClient();
  const { data, error } = await supabase.from('leaderboard').select('nickname, xp');
  if (error) throw error;
  return data || [];
}

export async function getQuizAttempts() {
  return listQuizAttempts({
    localAdapter: getLocalStorageAdapter(),
    client: currentSession ? client : null,
    userId: currentSession?.user.id || null
  });
}

export async function recordQuizAttempt(attempt) {
  return saveQuizAttempt({
    localAdapter: getLocalStorageAdapter(),
    client: currentSession ? client : null,
    userId: currentSession?.user.id || null,
    attempt
  });
}
