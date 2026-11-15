// End-to-end smoke tests: load every real page module in a DOM (jsdom), click through
// the main flows, and fail on any thrown error or console.error. Run with `npm test`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { SUPABASE_URL } from '../js/config.js';
import { renderHomePage } from '../js/pages/home-view.mjs';

const root = resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let runId = 0;
const problems = [];
process.on('unhandledRejection', (reason) => problems.push(`unhandled rejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => problems.push(`uncaught exception: ${error?.stack || error}`));

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

async function openPage(file, { seed = {}, supabase = null, search = '' } = {}) {
  const html = await readFile(resolve(root, file), 'utf8');
  const dom = new JSDOM(html, { url: `http://localhost/${file}${search}`, pretendToBeVisual: true });
  const { window } = dom;
  for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, JSON.stringify(value));
  if (supabase) window.supabase = supabase;
  else if (process.env.STUB_SUPABASE) window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }) };
  defineGlobal('window', window);
  defineGlobal('document', window.document);
  defineGlobal('location', window.location);
  defineGlobal('localStorage', window.localStorage);
  defineGlobal('FormData', window.FormData);
  defineGlobal('fetch', async (url) => {
    const match = String(url).match(/(data\/.+)$/);
    if (!match) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => JSON.parse(await readFile(resolve(root, match[1]), 'utf8')) };
  });
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); };
  const entry = file === 'index.html' ? 'js/pages/home.js'
    : file === 'pages/login.html' ? 'js/pages/login.js'
    : file === 'pages/forgot-password.html' ? 'js/pages/forgot-password.js'
    : file === 'pages/reset-password.html' ? 'js/pages/reset-password.js'
    : file === 'pages/confirm-email.html' ? 'js/pages/confirm-email.js'
    : file === 'pages/invitation.html' ? 'js/pages/invitation.js'
    : file === 'pages/magic-link.html' ? 'js/pages/magic-link.js'
    : file === 'pages/change-email.html' ? 'js/pages/change-email.js'
    : file === 'pages/reauthenticate.html' ? 'js/pages/reauthenticate.js'
    : 'js/pages/app.js';
  await import(`${pathToFileURL(resolve(root, entry)).href}?run=${runId += 1}`);
  const host = window.document.querySelector('#app, #home-app, #login-app, #auth-flow-app');
  for (let waited = 0; host.getAttribute('aria-busy') !== 'false' && waited < 4000; waited += 10) await sleep(10);
  const page = {
    window, host, errors,
    $: (selector) => window.document.querySelector(selector),
    $$: (selector) => [...window.document.querySelectorAll(selector)],
    click: (selector) => { const el = page.$(selector); assert.ok(el, `missing ${selector}`); el.click(); },
    choose(selector = 'input[type="radio"]') {
      const input = page.$(selector); assert.ok(input, `missing ${selector}`);
      input.checked = true; input.dispatchEvent(new window.Event('change', { bubbles: true }));
    },
    text: () => host.textContent.replace(/\s+/g, ' ').trim(),
    storage: (key) => JSON.parse(window.localStorage.getItem(key) || 'null'),
    async until(check, label) {
      for (let waited = 0; waited < 3000; waited += 10) { if (check()) return; await sleep(10); }
      assert.fail(`timed out waiting for ${label}`);
    },
    done(expectedErrors = []) {
      console.error = originalError;
      for (const expected of expectedErrors) {
        assert.ok(errors.some((error) => error.includes(expected)), `expected console.error containing ${expected}`);
      }
      assert.deepEqual(
        errors.filter((error) => !expectedErrors.some((expected) => error.includes(expected))),
        [],
        `unexpected console.error during ${file}: ${errors.join(' | ')}`
      );
      window.close();
    }
  };
  assert.equal(host.getAttribute('aria-busy'), 'false', `${file} never finished loading. console.error: ${errors.join(' | ') || 'none'}`);
  return page;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

async function withAuthApi(auth, run) {
  const dom = new JSDOM('', { url: 'http://localhost/pages/login.html' });
  dom.window.supabase = { createClient: () => ({ auth }) };
  defineGlobal('window', dom.window);
  defineGlobal('document', dom.window.document);
  defineGlobal('location', dom.window.location);
  defineGlobal('localStorage', dom.window.localStorage);
  const api = await import(`${pathToFileURL(resolve(root, 'js/core/auth.js')).href}?auth-run=${runId += 1}`);
  try {
    await run(api);
  } finally {
    dom.window.close();
  }
}

function createSessionClient(session, authOverrides = {}, callbackEvent = null, databaseCalls = []) {
  let authListener = null;
  const auth = {
    getSession: async () => {
      if (callbackEvent) authListener?.(callbackEvent, session);
      return { data: { session }, error: null };
    },
    getUser: async () => ({ data: { user: session?.user || null }, error: null }),
    onAuthStateChange: (listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe() { authListener = null; } } } };
    },
    ...authOverrides
  };
  return {
    auth,
    rpc: async (name) => ({ data: name === 'list_blocked_profiles' ? [] : null, error: null }),
    from(table) {
      const result = {
        data: table === 'profiles'
          ? {
            nickname: 'Learner',
            xp: 0,
            level: 1,
            streak: 0,
            last_active: null,
            public_handle: 'a'.repeat(32),
            profile_visibility: 'private',
            search_opt_in: false,
            study_time_visibility: 'private',
            fastest_times_visibility: 'private',
            stats_visibility: 'private',
            badges_visibility: 'private',
            mastery_visibility: 'private',
            activity_visibility: 'private',
            leaderboard_opt_in: false,
            selected_title: null,
            pinned_badge_ids: []
          }
          : [],
        error: null
      };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(result),
        is: () => Promise.resolve({ ...result, count: 0 }),
        single: () => Promise.resolve(result),
        update: (payload) => { databaseCalls.push({ table, payload }); return chain; },
        insert: async () => ({ error: null }),
        upsert: async () => ({ error: null }),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      };
      return chain;
    }
  };
}

test('auth validation rejects malformed email, weak passwords, mismatches, and blank codes', async () => {
  const { validatePasswordResetEmail, validateNewPasswordFields, validateOtpField } = await import('../js/core/auth-validation.mjs');
  assert.equal(validatePasswordResetEmail('not-an-email'), 'Enter a valid email address.');
  assert.equal(validatePasswordResetEmail(' learner@example.com '), '');
  assert.deepEqual(validateNewPasswordFields({ password: 'short', confirmPassword: 'different' }), {
    password: 'Use a password with at least 8 characters.',
    confirmPassword: 'Passwords do not match.'
  });
  assert.equal(validateOtpField(''), 'Enter the verification code.');
});

test('auth actions use their dedicated page redirects and trimmed input', async () => {
  const calls = [];
  const auth = {
    resetPasswordForEmail: async (...args) => { calls.push(['resetPasswordForEmail', ...args]); return { error: null }; },
    signInWithOtp: async (...args) => { calls.push(['signInWithOtp', ...args]); return { error: null }; },
    updateUser: async (...args) => { calls.push(['updateUser', ...args]); return { error: null }; },
    reauthenticate: async (...args) => { calls.push(['reauthenticate', ...args]); return { error: null }; },
    verifyOtp: async (...args) => { calls.push(['verifyOtp', ...args]); return { data: { session: null }, error: null }; }
  };
  await withAuthApi(auth, async ({ requestPasswordReset, updatePassword, sendMagicLink, verifyEmailOtp, requestEmailChange, requestReauthentication, verifyReauthenticationCode }) => {
    await requestPasswordReset(' learner@example.com ');
    await updatePassword('new-password-123');
    await sendMagicLink(' learner@example.com ');
    await verifyEmailOtp(' learner@example.com ', '123456');
    await requestEmailChange(' next@example.com ');
    await requestReauthentication();
    await verifyReauthenticationCode(' learner@example.com ', '654321');
  });

  assert.deepEqual(calls[0], ['resetPasswordForEmail', 'learner@example.com', {
    redirectTo: 'http://localhost/pages/reset-password.html'
  }]);
  assert.deepEqual(calls[1], ['updateUser', { password: 'new-password-123' }]);
  assert.deepEqual(calls[2], ['signInWithOtp', {
    email: 'learner@example.com',
    options: { emailRedirectTo: 'http://localhost/pages/magic-link.html', shouldCreateUser: false }
  }]);
  assert.deepEqual(calls[3], ['verifyOtp', { email: 'learner@example.com', token: '123456', type: 'email' }]);
  assert.deepEqual(calls[4], ['updateUser', { email: 'next@example.com' }, {
    emailRedirectTo: 'http://localhost/pages/change-email.html'
  }]);
  assert.deepEqual(calls[5], ['reauthenticate']);
  assert.deepEqual(calls[6], ['verifyOtp', { email: 'learner@example.com', token: '654321', type: 'reauthentication' }]);
});

test('auth action failures reject instead of appearing successful', async () => {
  const auth = {
    resetPasswordForEmail: async () => ({ error: { message: 'mail delivery failed' } })
  };
  await withAuthApi(auth, async ({ requestPasswordReset }) => {
    await assert.rejects(requestPasswordReset('learner@example.com'), /mail delivery failed/);
  });
});

test('Google sign-in uses the Google provider and dashboard redirect', async () => {
  const calls = [];
  await withAuthApi({
    signInWithOAuth: async (...args) => { calls.push(args); return { error: null }; }
  }, async ({ signInWithGoogle }) => {
    await signInWithGoogle();
  });
  assert.deepEqual(calls, [[{
    provider: 'google',
    options: { redirectTo: 'http://localhost/pages/dashboard.html' }
  }]]);
});

test('Google sign-in errors reject instead of appearing successful', async () => {
  await withAuthApi({
    signInWithOAuth: async () => ({ error: { message: 'Google provider unavailable' } })
  }, async ({ signInWithGoogle }) => {
    await assert.rejects(signInWithGoogle(), /Google provider unavailable/);
  });
});

test('login links to the password-recovery request page', async () => {
  const page = await openPage('pages/login.html');
  assert.equal(page.$('[data-forgot-password]')?.getAttribute('href'), 'forgot-password.html');
  page.done();
});

test('login gives an email example and toggles password visibility', async () => {
  const page = await openPage('pages/login.html');
  const email = page.$('[name="email"]');
  const password = page.$('#password');
  const toggle = page.$('[data-password-toggle]');

  assert.equal(email.getAttribute('placeholder'), 'example@gmail.com');
  assert.equal(password.type, 'password');
  assert.equal(toggle.textContent.trim(), 'Show');
  assert.equal(toggle.getAttribute('aria-label'), 'Show password');
  page.click('[data-password-toggle]');
  assert.equal(password.type, 'text');
  assert.equal(toggle.getAttribute('aria-label'), 'Hide password');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  page.click('[data-password-toggle]');
  assert.equal(password.type, 'password');
  assert.equal(toggle.getAttribute('aria-label'), 'Show password');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  page.done();
});

test('login removes redundant options while keeping its main actions', async () => {
  const page = await openPage('pages/login.html', {
    supabase: { createClient: () => createSessionClient(null) }
  });
  assert.equal(page.$('[data-resend]'), null);
  assert.equal(page.$('details[data-auth-options]'), null, 'redundant sign-in options disclosure is removed');
  assert.equal(page.$('[data-magic-link]'), null, 'email-link option is removed');
  assert.ok(page.$('[data-google-sign-in]'), 'Google sign-in remains available');
  assert.ok(page.$('.auth-password-heading [data-forgot-password]'), 'recovery link shares the password row');
  assert.ok(page.$('.auth-signup-prompt [data-switch]'), 'signup stays available');
  assert.ok(page.$('a[data-guest-link]'), 'guest access remains a link');
  page.done();
});

test('login only offers resend for unconfirmed-email errors', async () => {
  const errors = [
    { code: 'email_not_confirmed', message: 'Email not confirmed' },
    { code: 'invalid_credentials', message: 'Invalid login credentials' }
  ];
  let attemptNumber = 0;
  const client = createSessionClient(null, {
    signInWithPassword: async () => ({ data: null, error: errors[attemptNumber++] })
  });
  const page = await openPage('pages/login.html', { supabase: { createClient: () => client } });
  const submit = async () => {
    page.$('[name="email"]').value = 'student@example.com';
    page.$('[name="password"]').value = 'valid-password';
    page.$('#auth-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
    await page.until(() => page.$('#auth-form')?.getAttribute('aria-busy') !== 'true', 'sign-in request');
  };

  await submit();
  assert.ok(page.$('[data-resend]'), 'unconfirmed email exposes resend');
  await submit();
  assert.equal(page.$('[data-resend]'), null, 'invalid credentials do not expose resend');
  page.done();
});

test('signup confirmation and duplicate states retain the resend action', async () => {
  const responses = [
    { data: { user: { identities: [{}] }, session: null }, error: null },
    { data: { user: { identities: [] }, session: null }, error: null }
  ];
  let signUpNumber = 0;
  const signUpCalls = [];
  const client = createSessionClient(null, {
    signUp: async (payload) => {
      signUpCalls.push(payload);
      return responses[signUpNumber++];
    }
  });
  const page = await openPage('pages/login.html', { supabase: { createClient: () => client } });
  const submitSignup = async () => {
    page.$('[name="nickname"]').value = 'Learner';
    page.$('[name="email"]').value = 'student@example.com';
    page.$('[name="password"]').value = 'valid-password';
    page.$('#auth-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
    await page.until(() => page.$('#auth-form')?.getAttribute('aria-busy') !== 'true', 'signup request');
    assert.ok(page.$('[data-resend]'), `confirmation resend action; calls: ${signUpCalls.length}; page: ${page.text()}`);
  };

  page.click('[data-switch]');
  await submitSignup();
  page.click('[data-switch]');
  assert.equal(page.$('[data-resend]'), null, 'resend is hidden again while editing signup');
  await submitSignup();
  assert.match(page.text(), /This email is already registered/);
  page.done();
});

test('login/signup page offers Google without removing email authentication', async () => {
  const client = createSessionClient(null, { signInWithOAuth: async () => ({ error: null }) });
  const page = await openPage('pages/login.html', { supabase: { createClient: () => client } });
  assert.ok(page.$('[data-google-sign-in]'));
  assert.ok(page.$('#auth-form'));
  assert.ok(page.$('[name="email"]'));
  page.click('[data-switch]');
  assert.ok(page.$('[data-google-sign-in]'), 'Google sign-in remains available in signup mode');
  assert.ok(page.$('[name="nickname"]'));
  page.done();
});

test('login page displays Google OAuth errors', async () => {
  const client = createSessionClient(null, {
    signInWithOAuth: async () => ({ error: { message: 'Google sign-in unavailable' } })
  });
  const page = await openPage('pages/login.html', { supabase: { createClient: () => client } });
  page.click('[data-google-sign-in]');
  await page.until(() => Boolean(page.$('[role="alert"]')), 'Google sign-in error');
  assert.match(page.$('[role="alert"]').textContent, /Google sign-in unavailable/);
  page.done();
});

test('password-recovery request validates email and uses a neutral inbox message', async () => {
  let requests = 0;
  const client = {
    auth: {
      resetPasswordForEmail: async () => { requests += 1; return { error: null }; }
    }
  };
  const page = await openPage('pages/forgot-password.html', { supabase: { createClient: () => client } });
  const submit = () => page.$('#forgot-password-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  page.$('[name="email"]').value = 'bad-address';
  submit();
  assert.equal(requests, 0);
  assert.equal(page.$('[name="email"]').getAttribute('aria-invalid'), 'true');
  assert.match(page.$('#email-error').textContent, /valid email/i);

  page.$('[name="email"]').value = 'student@example.com';
  submit();
  await page.until(() => requests === 1, 'password reset request');
  assert.match(page.$('[data-auth-status]').textContent, /if an account exists/i);
  assert.equal(page.$('[data-auth-status]').getAttribute('role'), 'status');
  page.done();
});

test('password-reset page rejects a missing recovery session and offers a restart', async () => {
  const page = await openPage('pages/reset-password.html');
  assert.match(page.text(), /invalid or has expired/i);
  assert.ok(page.$('[data-restart-reset]'), 'recovery restart link');
  page.done();
});

test('password-reset page does not accept an unrelated signed-in session', async () => {
  const session = { user: { id: 'user-1', email: 'student@example.com' } };
  let onAuthStateChange;
  const resultFor = (table) => ({
    data: table === 'profiles'
      ? { nickname: 'Learner', xp: 0, level: 1, streak: 0, last_active: null }
      : [],
    error: null
  });
  const client = {
    auth: {
      getSession: async () => {
        onAuthStateChange('INITIAL_SESSION', session);
        return { data: { session }, error: null };
      },
      onAuthStateChange: (callback) => {
        onAuthStateChange = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from(table) {
      const result = resultFor(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve(result),
        update: () => chain,
        upsert: async () => ({ error: null }),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      };
      return chain;
    }
  };
  const page = await openPage('pages/reset-password.html', {
    search: '?code=ordinary-sign-in-code',
    supabase: { createClient: () => client }
  });
  assert.match(page.text(), /invalid or has expired/i);
  assert.equal(page.$('#reset-password-form'), null);
  page.done();
});

test('password-reset page rejects mismatches and updates the password for a valid recovery session', async () => {
  let updates = 0;
  const session = { user: { id: 'user-1', email: 'student@example.com' } };
  const resultFor = (table) => ({
    data: table === 'profiles'
      ? { nickname: 'Learner', xp: 0, level: 1, streak: 0, last_active: null }
      : [],
    error: null
  });
  let onAuthStateChange;
  const client = {
    auth: {
      getSession: async () => {
        onAuthStateChange('PASSWORD_RECOVERY', session);
        return { data: { session }, error: null };
      },
      onAuthStateChange: (callback) => {
        onAuthStateChange = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      updateUser: async () => { updates += 1; return { error: null }; }
    },
    from(table) {
      const result = resultFor(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve(result),
        update: () => chain,
        upsert: async () => ({ error: null }),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      };
      return chain;
    }
  };
  const page = await openPage('pages/reset-password.html', {
    search: '?code=recovery-code',
    supabase: { createClient: () => client }
  });
  const submit = () => page.$('#reset-password-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  page.$('[name="password"]').value = 'new-password-123';
  page.$('[name="confirmPassword"]').value = 'different-password';
  submit();
  assert.equal(updates, 0);
  assert.match(page.$('#confirm-password-error').textContent, /do not match/i);

  page.$('[name="password"]').value = 'new-password-123';
  page.$('[name="confirmPassword"]').value = 'new-password-123';
  submit();
  await page.until(() => updates === 1, 'password update');
  assert.match(page.text(), /password updated/i);
  page.done();
});

test('signup and resend confirmation return to the confirmation page', async () => {
  const calls = [];
  const auth = {
    signUp: async (...args) => {
      calls.push(['signUp', ...args]);
      return { data: { user: { identities: [{}] }, session: null }, error: null };
    },
    resend: async (...args) => { calls.push(['resend', ...args]); return { error: null }; }
  };
  await withAuthApi(auth, async ({ signUp, resendSignupConfirmation }) => {
    const result = await signUp({ nickname: 'Learner', email: 'student@example.com', password: 'valid-password' });
    assert.equal(result.needsEmailConfirmation, true);
    await resendSignupConfirmation('student@example.com');
  });
  assert.equal(calls[0][1].options.emailRedirectTo, 'http://localhost/pages/confirm-email.html');
  assert.equal(calls[1][1].options.emailRedirectTo, 'http://localhost/pages/confirm-email.html');
});

test('confirmation page shows success only for a confirmed callback session', async () => {
  const session = { user: { id: 'user-1', email: 'student@example.com', email_confirmed_at: '2026-11-12T00:00:00Z' } };
  const page = await openPage('pages/confirm-email.html', {
    search: '?code=confirmation-code',
    supabase: { createClient: () => createSessionClient(session, {}, 'SIGNED_IN') }
  });
  assert.match(page.text(), /email.*confirmed/i);
  assert.equal(page.$('[data-auth-status]')?.getAttribute('role'), 'status');
  page.done();
});

test('confirmation page reports a missing callback session', async () => {
  const page = await openPage('pages/confirm-email.html');
  assert.match(page.text(), /link is invalid or has expired/i);
  assert.equal(page.$('[role="alert"]')?.getAttribute('role'), 'alert');
  page.done();
});

test('confirmation page does not mistake a cached session for a verified callback', async () => {
  const session = { user: { id: 'old-user', email: 'student@example.com', email_confirmed_at: '2026-11-12T00:00:00Z' } };
  const page = await openPage('pages/confirm-email.html', {
    search: '?code=expired-code',
    supabase: { createClient: () => createSessionClient(session) }
  });
  assert.match(page.text(), /link is invalid or has expired/i);
  page.done();
});

test('invitation page requires a session and confirmed matching passwords', async () => {
  const expired = await openPage('pages/invitation.html');
  assert.match(expired.text(), /invitation.*invalid or has expired/i);
  expired.done();

  let updates = 0;
  const session = { user: { id: 'user-2', email: 'invitee@example.com' } };
  const client = createSessionClient(session, {
    updateUser: async () => { updates += 1; return { error: null }; }
  }, 'SIGNED_IN');
  const page = await openPage('pages/invitation.html', {
    search: '?code=invite-code',
    supabase: { createClient: () => client }
  });
  const submit = () => page.$('#invitation-password-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  page.$('[name="password"]').value = 'invited-password';
  page.$('[name="confirmPassword"]').value = 'different-password';
  submit();
  assert.equal(updates, 0);
  assert.match(page.$('#confirm-password-error').textContent, /do not match/i);

  page.$('[name="password"]').value = 'invited-password';
  page.$('[name="confirmPassword"]').value = 'invited-password';
  submit();
  await page.until(() => updates === 1, 'invitation password update');
  assert.match(page.text(), /invitation accepted/i);
  page.done();
});

test('magic-link page offers Google while preserving email-link and OTP forms', async () => {
  const client = createSessionClient(null, {
    signInWithOAuth: async () => ({ error: null }),
    signInWithOtp: async () => ({ error: null })
  });
  const page = await openPage('pages/magic-link.html', { supabase: { createClient: () => client } });
  assert.ok(page.$('[data-google-sign-in]'));
  assert.ok(page.$('#magic-link-form'));
  page.$('[name="email"]').value = 'student@example.com';
  page.$('#magic-link-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => Boolean(page.$('#otp-form')), 'email OTP form');
  assert.ok(page.$('[data-google-sign-in]'), 'Google sign-in remains available in OTP mode');
  page.done();
});

test('magic-link page displays Google OAuth errors', async () => {
  const client = createSessionClient(null, {
    signInWithOAuth: async () => ({ error: { message: 'Google sign-in unavailable' } })
  });
  const page = await openPage('pages/magic-link.html', { supabase: { createClient: () => client } });
  page.click('[data-google-sign-in]');
  await page.until(() => Boolean(page.$('[role="alert"]')), 'Google sign-in error');
  assert.match(page.$('[role="alert"]').textContent, /Google sign-in unavailable/);
  page.done();
});

test('magic-link page validates email and sends a neutral sign-in status', async () => {
  let requests = 0;
  const client = {
    auth: {
      signInWithOtp: async () => { requests += 1; return { error: null }; }
    }
  };
  const page = await openPage('pages/magic-link.html', { supabase: { createClient: () => client } });
  const send = () => page.$('#magic-link-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  page.$('[name="email"]').value = 'bad-address';
  send();
  assert.equal(requests, 0);
  assert.match(page.$('#email-error').textContent, /valid email/i);

  page.$('[name="email"]').value = 'student@example.com';
  send();
  await page.until(() => requests === 1, 'magic-link email request');
  assert.match(page.$('[data-auth-status]').textContent, /if an account exists/i);
  assert.ok(page.$('#otp-form'), 'OTP entry form appears after sending a link');
  page.done();
});

test('magic-link page rejects blank and invalid OTPs, then accepts a valid code', async () => {
  const tokens = [];
  const session = { user: { id: 'user-1', email: 'student@example.com' } };
  const client = createSessionClient(null, {
    signInWithOtp: async () => ({ error: null }),
    verifyOtp: async (params) => {
      tokens.push(params.token);
      return params.token === '123456'
        ? { data: { session }, error: null }
        : { data: { session: null }, error: { message: 'Invalid OTP' } };
    }
  });
  const page = await openPage('pages/magic-link.html', { supabase: { createClient: () => client } });
  page.$('#email').value = 'student@example.com';
  page.$('#magic-link-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => Boolean(page.$('#otp-form')), 'OTP entry form');
  page.$('[name="token"]').value = '';
  const verify = () => page.$('#otp-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  verify();
  assert.deepEqual(tokens, []);
  assert.match(page.$('#token-error').textContent, /verification code/i);

  page.$('[name="token"]').value = 'bad-code';
  verify();
  await page.until(() => Boolean(page.$('[role="alert"]')), 'invalid OTP message');
  assert.equal(tokens.length, 1);
  assert.match(page.$('[role="alert"]').textContent, /invalid otp/i);

  page.$('[name="token"]').value = '123456';
  verify();
  await page.until(() => /signed in/i.test(page.text()), 'successful OTP sign-in');
  assert.equal(page.$('[data-auth-status]')?.getAttribute('role'), 'status');
  page.done();
});

test('magic-link callback requires a callback session before showing success', async () => {
  const expired = await openPage('pages/magic-link.html', { search: '?code=expired-code' });
  assert.match(expired.text(), /link is invalid or has expired/i);
  expired.done();

  const session = { user: { id: 'user-3', email: 'student@example.com' } };
  const valid = await openPage('pages/magic-link.html', {
    search: '?code=magic-code',
    supabase: { createClient: () => createSessionClient(session, {}, 'SIGNED_IN') }
  });
  assert.match(valid.text(), /signed in/i);
  valid.done();
});

test('magic-link callback errors show an expired-link message', async () => {
  const page = await openPage('pages/magic-link.html', {
    search: '?error=access_denied&error_code=otp_expired'
  });
  assert.match(page.text(), /sign-in link is invalid or has expired/i);
  page.done();
});

const savedAuthToken = { [`sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`]: { access_token: 'test-token' } };

test('profile: owner dashboard loads private learner data above Personal details', async () => {
  const session = { user: { id: 'user-owner-dashboard', email: 'student@example.com' } };
  const handle = 'a'.repeat(32);
  const rpcCalls = [];
  const client = createSessionClient(session);
  client.rpc = async (name, args) => {
    rpcCalls.push({ name, args });
    if (name === 'load_public_profile') {
      return {
        data: {
          handle,
          nickname: 'Mika Santos',
          title: 'Logic Apprentice',
          level: 8,
          memberSince: '2025-09-01',
          sections: {
            studyTime: { totalSeconds: 66240, thisWeekSeconds: 15000, averageSecondsPerDay: 2520 },
            fastestTimes: { items: [{ type: 'quiz', title: 'Truth tables quiz', durationSeconds: 161, score: 5, total: 5 }] },
            stats: { xp: 2480, streak: 12, lessonsCompleted: 18, quizzesTaken: 34 },
            badges: { pinned: [{ id: 'first-step', title: 'First Step' }], earnedCount: 12 },
            mastery: [{ title: 'Propositional logic', completed: 9, total: 10, percent: 90 }],
            activity: [{ label: 'Finished Logic course', occurredAt: '2025-10-28T00:00:00Z' }]
          }
        },
        error: null
      };
    }
    return { data: [], error: null };
  };
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => client }
  });
  const dashboard = page.$('.public-profile-page');
  const personalDetails = page.$('#profile-details');
  assert.ok(
    dashboard,
    `owner profile dashboard is rendered on the profile route; error: ${page.$('[data-profile-dashboard-error]')?.textContent || 'none'}; console: ${page.errors.join(' | ') || 'none'}`
  );
  assert.ok(personalDetails, 'Personal details remain editable below the dashboard');
  assert.ok(dashboard.compareDocumentPosition(personalDetails) & page.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.match(dashboard.textContent, /Mika Santos/);
  assert.match(dashboard.textContent, /Truth tables quiz/);
  assert.match(dashboard.textContent, /Finished Logic course/);
  assert.match(dashboard.querySelector('[data-profile-badges]').textContent, /12 of 23/);
  assert.equal(dashboard.querySelector('[data-profile-share]').disabled, true, 'private owners cannot share their profile');
  assert.equal(dashboard.querySelector('[data-profile-preview]').getAttribute('href').includes('preview=visitor'), true);
  assert.equal(dashboard.querySelector('[data-profile-visibility]').getAttribute('href'), '#profile-visibility');
  assert.deepEqual(rpcCalls.find(({ name }) => name === 'load_public_profile'), {
    name: 'load_public_profile',
    args: { target_handle: handle, visitor_preview: false }
  });
  assert.ok(page.$('[data-profile-visibility-form]'), 'privacy settings remain available below the dashboard');
  const nickname = page.$('#profile-nickname');
  nickname.value = 'Mika Chen';
  page.$('[data-profile-form]').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => /Profile settings saved/.test(page.text()), 'the profile settings to save');
  assert.equal(dashboard.querySelector('.public-profile-identity h2').textContent, 'Mika Chen');
  assert.equal(dashboard.querySelector('.public-profile-identity .profile-avatar').textContent, 'MC');
  page.done();
});

test('profile: guest dashboard avoids fabricated metrics and preserves Personal details', async () => {
  const page = await openPage('pages/profile.html');
  assert.match(page.text(), /dashboard is available after signing in/i);
  assert.equal(page.$('.public-profile-page'), null);
  assert.equal(page.$('[data-profile-share]'), null);
  assert.ok(page.$('#profile-details'), 'guest Personal details remain editable');
  assert.ok(page.$('[data-profile-form]'), 'guest preferences remain available');
  page.done();
});

test('profile: owner dashboard load errors preserve settings and privacy controls', async () => {
  const session = { user: { id: 'user-owner-dashboard-error', email: 'student@example.com' } };
  const client = createSessionClient(session);
  client.rpc = async (name) => name === 'load_public_profile'
    ? { data: null, error: new Error('Profile RPC failed') }
    : { data: [], error: null };
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => client }
  });
  const dashboardError = page.$('[data-profile-dashboard-error]');
  assert.ok(dashboardError, 'dashboard load failure is visible');
  assert.match(dashboardError.textContent, /could not load your profile dashboard/i);
  assert.ok(page.$('#profile-details'), 'Personal details remain editable after the dashboard error');
  assert.ok(page.$('[data-profile-visibility-form]'), 'privacy controls remain available after the dashboard error');
  page.done(['Could not load the owner profile dashboard']);
});

test('profile: owner dashboard handles a missing profile link without an RPC request', async () => {
  const session = { user: { id: 'user-owner-dashboard-no-handle', email: 'student@example.com' } };
  const rpcCalls = [];
  const client = createSessionClient(session);
  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const query = originalFrom(table);
    if (table === 'profiles') {
      const originalSingle = query.single;
      query.single = async () => {
        const result = await originalSingle();
        return { ...result, data: { ...result.data, public_handle: null } };
      };
    }
    return query;
  };
  client.rpc = async (name, args) => {
    rpcCalls.push({ name, args });
    return { data: [], error: null };
  };
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => client }
  });
  assert.match(page.$('[data-profile-dashboard-error]').textContent, /profile link is not available/i);
  assert.equal(rpcCalls.some(({ name }) => name === 'load_public_profile'), false);
  assert.equal(page.$('[data-public-profile-url]'), null, 'missing handles do not produce an invalid profile URL');
  assert.ok(page.$('#profile-details'));
  page.done();
});

test('profile: compact identity header precedes preferences', async () => {
  const page = await openPage('pages/profile.html');
  const profile = page.$('.profile-page');
  assert.ok(profile, 'Profile uses its scoped page layout');
  const layout = profile.querySelector('.profile-layout');
  const summary = layout.querySelector('.profile-summary');
  const form = layout.querySelector('[data-profile-form]');
  assert.equal(layout.firstElementChild, summary, 'the compact identity header leads the settings form');
  assert.equal(layout.children[1], form, 'the settings form follows the identity header');
  assert.ok(summary.querySelector('.profile-avatar'), 'the summary keeps the learner avatar');
  assert.ok(summary.querySelector('.tag'), 'the summary keeps the guest or sync status');
  assert.equal(summary.querySelector('.profile-summary-details'), null, 'the summary omits details duplicated in the form');
  assert.ok(form.querySelector('#profile-program'), 'program remains editable in the form');
  assert.ok(form.querySelector('#profile-year-level'), 'year level remains editable in the form');
  assert.equal(profile.lastElementChild, profile.querySelector('.profile-account'), 'account and privacy follows the preferences');
  page.done();
});

test('signed-in profile exposes account security links while guest profile does not', async () => {
  const guest = await openPage('pages/profile.html');
  assert.equal(guest.$('[data-change-email]'), null);
  assert.equal(guest.$('[data-reauthenticate]'), null);
  guest.done();

  const session = { user: { id: 'user-4', email: 'student@example.com' } };
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => createSessionClient(session) }
  });
  assert.equal(page.$('[data-change-email]')?.getAttribute('href'), '../pages/change-email.html');
  assert.equal(page.$('[data-reauthenticate]')?.getAttribute('href'), '../pages/reauthenticate.html');
  page.done();
});

test('profile: signed-in learner can save public visibility and leaderboard opt-in', async () => {
  const session = { user: { id: 'user-profile-visibility', email: 'student@example.com' } };
  const databaseCalls = [];
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => createSessionClient(session, {}, null, databaseCalls) }
  });
  const form = page.$('[data-profile-visibility-form]');
  assert.ok(form, 'signed-in profile includes privacy settings');
  assert.ok(page.$('[data-public-profile-url]')?.href.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
  form.elements.profileVisibility.value = 'public';
  form.elements.studyTimeVisibility.value = 'public';
  form.elements.searchOptIn.checked = true;
  form.elements.leaderboardOptIn.checked = true;
  form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => /privacy settings saved/i.test(page.$('[data-profile-visibility-status]').textContent), 'saved profile visibility');
  const update = databaseCalls.find(({ table }) => table === 'profiles');
  assert.deepEqual(update.payload, {
    profile_visibility: 'public',
    search_opt_in: true,
    leaderboard_opt_in: true,
    study_time_visibility: 'public',
    fastest_times_visibility: 'private',
    stats_visibility: 'private',
    badges_visibility: 'private',
    mastery_visibility: 'private',
    activity_visibility: 'private'
  });
  page.done();
});

test('achievements: guest unlocks, progress, and pinned badges persist locally', async () => {
  const page = await openPage('pages/achievements.html', {
    seed: {
      'dfh:learner-events:guest': {
        events: [{
          id: 'guest-opened-first-lesson',
          type: 'lesson-opened',
          data: { lessonId: 'logic-propositions' },
          occurredAt: '2025-01-02T00:00:00Z'
        }],
        completions: []
      }
    }
  });
  assert.match(page.text(), /1 of 23 earned/);
  assert.ok(page.$('[data-achievement="first-step"].achievement-earned'));
  page.click('[data-pin-badge="first-step"]');
  await page.until(() => page.storage('dfh:guest-profile-presentation')?.pinnedBadgeIds?.includes('first-step'), 'saved guest badge pin');
  page.done();
});

test('public profile: invalid handles are unavailable without requiring a session', async () => {
  const page = await openPage('pages/public-profile.html', { search: '?handle=invalid' });
  assert.match(page.text(), /profile link is invalid or unavailable/i);
  assert.ok(page.$('script[src="../js/vendor/qrcode-generator.js"]'), 'public profile loads the local QR asset');
  page.done();
});

test('profile: guest with legacy state gets local preference defaults', async () => {
  const page = await openPage('pages/profile.html', {
    seed: { 'dfh:learner-state': { nickname: 'Legacy learner', xp: 25, completedLessons: [] } }
  });
  const { getState } = await import('../js/core/state.js');
  const state = await getState();
  assert.deepEqual(state.profilePreferences, {
    program: '',
    yearLevel: '',
    weeklyGoal: 3,
    sessionLength: 25,
    preferredTime: 'flexible',
    lessonStyle: 'worked-examples',
    studyReminders: false,
    assessmentUpdates: false,
    reduceMotion: false
  });
  page.done();
});

test('profile: signed-in preferences save locally without syncing', async () => {
  const session = { user: { id: 'user-profile-preferences', email: 'student@example.com' } };
  const databaseCalls = [];
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => createSessionClient(session, {}, null, databaseCalls) }
  });
  const { getState, saveState, saveProfilePreferences } = await import('../js/core/state.js');
  const state = await getState();
  const profilePreferences = {
    program: 'BS Computer Science',
    yearLevel: '2nd year',
    weeklyGoal: 4,
    sessionLength: 40,
    preferredTime: 'evening',
    lessonStyle: 'practice-first',
    studyReminders: true,
    assessmentUpdates: false,
    reduceMotion: true
  };
  await saveState({ ...state, nickname: 'Kian Reyes' });
  await saveProfilePreferences(profilePreferences);
  assert.deepEqual(page.storage('dfh:profile-preferences'), profilePreferences);
  assert.deepEqual(databaseCalls, [{ table: 'profiles', payload: { nickname: 'Kian Reyes' } }]);
  page.done();
});

test('profile: learner-state saves do not depend on local preference storage', async () => {
  const session = { user: { id: 'user-profile-preferences-storage-error', email: 'student@example.com' } };
  const databaseCalls = [];
  const page = await openPage('pages/profile.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => createSessionClient(session, {}, null, databaseCalls) }
  });
  const { getState, saveState } = await import('../js/core/state.js');
  const current = await getState();
  const { getLocalStorageAdapter } = await import('../js/core/storage.js');
  const localAdapter = getLocalStorageAdapter();
  const set = localAdapter.set;
  localAdapter.set = async (key, value) => {
    if (key === 'profile-preferences') throw new Error('Profile preferences storage is unavailable.');
    return set.call(localAdapter, key, value);
  };
  try {
    await saveState({ ...current, nickname: 'Kian Reyes' });
  } finally {
    localAdapter.set = set;
  }
  assert.deepEqual(databaseCalls, [{ table: 'profiles', payload: { nickname: 'Kian Reyes' } }]);
  page.done();
});

test('change-email request requires a signed-in user and validates the new address', async () => {
  const guest = await openPage('pages/change-email.html');
  assert.match(guest.text(), /sign in to change your email/i);
  guest.done();

  let requests = 0;
  const session = { user: { id: 'user-5', email: 'student@example.com' } };
  const client = createSessionClient(session, {
    updateUser: async () => { requests += 1; return { error: null }; }
  });
  const page = await openPage('pages/change-email.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => client }
  });
  const submit = () => page.$('#change-email-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  page.$('[name="email"]').value = 'bad-address';
  submit();
  assert.equal(requests, 0);
  assert.match(page.$('#email-error').textContent, /valid email/i);

  page.$('[name="email"]').value = 'new-address@example.com';
  submit();
  await page.until(() => requests === 1, 'email change request');
  await page.until(() => Boolean(page.$('[data-auth-status]')), 'email change status');
  assert.match(page.$('[data-auth-status]').textContent, /check both email inboxes/i);
  page.done();
});

test('email-change callback accepts a verified user-update event', async () => {
  const session = { user: { id: 'user-6', email: 'new-address@example.com' } };
  const page = await openPage('pages/change-email.html', {
    search: '?code=email-change-code',
    supabase: { createClient: () => createSessionClient(session, {}, 'USER_UPDATED') }
  });
  assert.match(page.text(), /email address updated/i);
  assert.equal(page.$('[data-auth-status]')?.getAttribute('role'), 'status');
  page.done();
});

test('email-change callback errors do not fall back to the signed-in request form', async () => {
  const session = { user: { id: 'user-6', email: 'student@example.com' } };
  const page = await openPage('pages/change-email.html', {
    seed: savedAuthToken,
    search: '?error=access_denied&error_code=otp_expired',
    supabase: { createClient: () => createSessionClient(session) }
  });
  assert.match(page.text(), /link is invalid or has expired/i);
  assert.equal(page.$('#change-email-form'), null);
  page.done();
});

test('reauthentication requires sign-in, validates OTP, and reports verification errors', async () => {
  const guest = await openPage('pages/reauthenticate.html');
  assert.match(guest.text(), /sign in to verify your identity/i);
  guest.done();

  const tokens = [];
  const session = { user: { id: 'user-7', email: 'student@example.com' } };
  const client = createSessionClient(session, {
    reauthenticate: async () => ({ error: null }),
    verifyOtp: async (params) => {
      tokens.push(params.token);
      return params.token === '123456'
        ? { data: { session }, error: null }
        : { data: { session: null }, error: { message: 'Invalid OTP' } };
    }
  });
  const page = await openPage('pages/reauthenticate.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => client }
  });
  page.click('[data-send-reauthentication]');
  await page.until(() => Boolean(page.$('#reauthentication-form')), 'reauthentication code form');
  const submit = () => page.$('#reauthentication-form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  page.$('[name="token"]').value = '';
  submit();
  assert.deepEqual(tokens, []);
  assert.match(page.$('#token-error').textContent, /verification code/i);

  page.$('[name="token"]').value = 'bad-code';
  submit();
  await page.until(() => Boolean(page.$('[role="alert"]')), 'invalid reauthentication code message');
  assert.match(page.$('[role="alert"]').textContent, /invalid otp/i);

  page.$('[name="token"]').value = '123456';
  submit();
  await page.until(() => /identity verified/i.test(page.text()), 'successful reauthentication');
  assert.equal(tokens.length, 2);
  page.done();
});

for (const [file, heading] of [
  ['index.html', 'Understand the logic'],
  ['pages/dashboard.html', 'Welcome back'],
  ['pages/courses.html', 'Learn one idea at a time'],
  ['pages/lessons.html', 'Propositions and connectives'],
  ['pages/flashcards.html', 'Flashcards for Logic'],
  ['pages/practice.html', 'Practice one idea at a time'],
  ['pages/quizzes.html', 'Check your understanding'],
  ['pages/assessments.html', 'Check what is sticking'],
  ['pages/progress.html', 'Progress you can understand'],
  ['pages/profile.html', 'Your study profile'],
  ['pages/achievements.html', 'Small wins add up'],
  ['pages/public-profile.html', 'Profile not available'],
  ['pages/login.html', 'Welcome back']
]) {
  test(`${file} renders without errors`, async () => {
    const page = await openPage(file);
    assert.ok(page.$('h1')?.textContent.includes(heading), `${file}: expected an h1 containing "${heading}"`);
    page.done();
  });
}

test('home: guest homepage keeps the main learning actions', async () => {
  const html = renderHomePage(null, { completedLessons: [], xp: 0 }, 'light');
  const dom = new JSDOM(html);
  const { document } = dom.window;
  assert.match(document.querySelector('h1')?.textContent || '', /Understand the logic behind every algorithm/);
  assert.equal([...document.querySelectorAll('a')].find((link) => link.textContent.includes('Start learning'))?.getAttribute('href'), 'pages/dashboard.html');
  assert.equal([...document.querySelectorAll('a')].find((link) => link.textContent.includes('Browse topics'))?.getAttribute('href'), '#topics');
  assert.equal(document.querySelector('.header-cta')?.getAttribute('href'), 'pages/login.html');
  assert.ok(document.querySelector('[data-theme-toggle]'));
  dom.window.close();
});

test('home: progress-aware hero keeps account and guest states', async () => {
  const signedIn = renderHomePage(
    { email: 'student@example.edu' },
    { completedLessons: [], xp: 0 },
    'light'
  );
  assert.match(signedIn, /Your learning is synced/);
  assert.match(signedIn, /Your study space is ready when you are/);
  assert.match(signedIn, /href="pages\/dashboard\.html">Continue learning/);

  const returningGuest = renderHomePage(
    null,
    { completedLessons: ['logic-propositions'], xp: 50 },
    'light'
  );
  assert.match(returningGuest, /Continue as a guest/);
  assert.match(returningGuest, /1 lesson completed · 50 XP/);
  assert.match(returningGuest, /href="pages\/dashboard\.html">Continue learning/);
});

test('home: theme toggle label reflects the active theme', async () => {
  const state = { completedLessons: [], xp: 0 };
  assert.match(renderHomePage(null, state, 'light'), /aria-label="Switch to dark theme"/);
  assert.match(renderHomePage(null, state, 'dark'), /aria-label="Switch to light theme"/);
});

test('home: topic previews render the complete topic data', async () => {
  const topics = JSON.parse(await readFile(resolve(root, 'data/topics.json'), 'utf8'));
  const page = await openPage('index.html');
  await page.until(
    () => page.$$('#topic-preview .topic-preview').length === topics.length,
    'all home topic previews'
  );
  for (const topic of topics) {
    const card = page.$$('#topic-preview .topic-preview')
      .find((item) => item.querySelector('h3')?.textContent === topic.title);
    assert.ok(card, `missing topic preview: ${topic.title}`);
    assert.equal(card.querySelector('.scope-label')?.textContent, topic.scopeLabel);
    assert.equal(card.querySelector('p')?.textContent, topic.summary);
  }
  page.done();
});

test('guests never load the Supabase client', async () => {
  const page = await openPage('pages/courses.html', { supabase: null });
  assert.equal(page.window.supabase, undefined);
  assert.equal(page.$$('script[src*="supabase"]').length, 0);
  page.done();
});

test('courses: catalogue lists available lessons before non-actionable upcoming topics', async () => {
  const page = await openPage('pages/courses.html');
  const available = page.$('.courses-available');
  const upcoming = page.$('.courses-upcoming');
  assert.ok(available, 'published courses have a dedicated catalogue section');
  assert.ok(upcoming, 'topics in preparation have a separate section');
  assert.ok(
    available.compareDocumentPosition(upcoming) & page.window.Node.DOCUMENT_POSITION_FOLLOWING,
    'available courses appear before upcoming topics'
  );
  assert.equal(page.$('[data-course-count="available"]').textContent.trim(), '1');
  assert.equal(page.$('[data-course-count="upcoming"]').textContent.trim(), '8');
  assert.match(available.textContent, /Logic/);
  for (const lessonId of ['logic-propositions', 'logic-truth-tables', 'logic-predicates']) {
    assert.ok(available.querySelector(`a[href*="${lessonId}"]`), `${lessonId} is linked from the available course`);
  }
  assert.equal(upcoming.querySelectorAll('.course-card-unavailable').length, 8);
  assert.equal(upcoming.querySelector('a, button'), null, 'upcoming topics are informational, not actionable');
  page.done();
});

test('courses: Logic progress and continue action reflect completed lessons', async () => {
  const page = await openPage('pages/courses.html', {
    seed: {
      'dfh:learner-state': {
        completedLessons: ['logic-propositions'],
        xp: 50,
        level: 1
      }
    }
  });
  const available = page.$('.courses-available');
  assert.ok(available, 'Logic is in the available courses section');
  assert.equal(available.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '1');
  assert.ok(
    available.querySelector('a[href*="logic-truth-tables"]'),
    'the course action continues with the first incomplete lesson'
  );
  page.done();
});

test('progress: course-first layout keeps topic availability secondary', async () => {
  const page = await openPage('pages/progress.html', {
    seed: {
      'dfh:learner-state': {
        completedLessons: ['logic-propositions'],
        xp: 50,
        level: 1,
        streak: 2
      }
    }
  });
  const progress = page.$('.progress-page');
  assert.ok(progress, 'Progress uses its course-first layout');
  const course = progress.querySelector('.progress-course-section');
  assert.ok(course, 'the published Logic course leads');
  assert.equal(course.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '1');
  const lessons = progress.querySelector('.progress-lesson-list');
  assert.equal(lessons.querySelectorAll('a').length, 3, 'all published Logic lessons remain linked');
  const upcoming = progress.querySelector('.progress-upcoming-section');
  assert.equal(upcoming.querySelectorAll('.progress-topic').length, 8, 'all eight unavailable topics remain visible');
  assert.equal(upcoming.querySelector('a'), null, 'coming-soon topics remain non-actionable');
  assert.equal(progress.querySelectorAll('.progress-summary-grid .progress-stat').length, 3);
  assert.match(progress.querySelector('.progress-history').textContent, /No quiz attempts yet/);
  page.done();
});

test('practice: lesson sets lead and mixed review follows', async () => {
  const page = await openPage('pages/practice.html');
  const layout = page.$('.practice-page');
  assert.ok(layout, 'Practice content uses its dedicated layout');
  const bank = JSON.parse(await readFile(resolve(root, 'data/quizzes/logic.json'), 'utf8'));
  const lessonQuizzes = bank.quizzes.filter((quiz) => quiz.questions.length);
  const actions = page.$$('.practice-grid [data-start-practice]');
  assert.deepEqual(
    actions.map((action) => action.dataset.startPractice),
    [...lessonQuizzes.map((quiz) => quiz.id), 'mixed-review'],
    'lesson practice actions follow the available bank order before mixed review'
  );
  for (const quiz of lessonQuizzes) {
    assert.match(
      page.$(`[data-start-practice="${quiz.id}"]`).closest('.practice-card').textContent,
      new RegExp(`${quiz.questions.length} questions`)
    );
  }
  assert.match(layout.textContent, /scores do not award XP or change lesson progress/);
  page.done();
});

test('practice: mixed review runs to a results screen', async () => {
  const page = await openPage('pages/practice.html');
  page.click('[data-start-practice="mixed-review"]');
  for (let question = 0; question < 5; question += 1) {
    page.choose('[data-learning-answer]');
    page.click('[data-learning-check]');
    assert.match(page.text(), /Correct\.|Not quite\./);
    page.click('[data-learning-next]');
  }
  assert.ok(page.$('#practice-results-heading'), 'practice results heading');
  assert.match(page.text(), /\d \/ 5/);
  page.click('[data-restart-learning]');
  assert.ok(page.$('[data-learning-answer]'), 'restart returns to the first question');
  page.done();
});

test('practice: a single lesson set runs too', async () => {
  const page = await openPage('pages/practice.html');
  page.click('[data-start-practice="logic-propositions"]');
  assert.match(page.text(), /Question 1 of 5/);
  page.done();
});

test('practice: answered De Morgan questions carry their achievement tag', async () => {
  const page = await openPage('pages/practice.html');
  const bank = JSON.parse(await readFile(resolve(root, 'data/quizzes/logic.json'), 'utf8'));
  const targetIndex = bank.quizzes.find((quiz) => quiz.id === 'logic-truth-tables').questions
    .findIndex((question) => question.id === 'equivalence-de-morgan');
  page.click('[data-start-practice="logic-truth-tables"]');
  for (let question = 0; question <= targetIndex; question += 1) {
    page.choose('[data-learning-answer]');
    page.click('[data-learning-check]');
    if (question < targetIndex) page.click('[data-learning-next]');
  }
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.events?.some((event) => event.data.questionId === 'equivalence-de-morgan'),
    'the De Morgan practice event'
  );
  const event = page.storage('dfh:learner-events:guest').events.find((item) => item.data.questionId === 'equivalence-de-morgan');
  assert.deepEqual(event.data.tags, ['de-morgan']);
  page.done();
});

test('quizzes: catalogue leads with lesson quizzes and keeps history below', async () => {
  const page = await openPage('pages/quizzes.html');
  const catalogue = page.$('.quiz-catalogue');
  assert.ok(catalogue, 'Quiz content uses its dedicated catalogue layout');
  const bank = JSON.parse(await readFile(resolve(root, 'data/quizzes/logic.json'), 'utf8'));
  const actions = page.$$('.quiz-catalogue [data-start-quiz]');
  assert.deepEqual(
    actions.map((action) => action.dataset.startQuiz),
    [...bank.quizzes.map((quiz) => quiz.id), 'mixed-review'],
    'lesson quizzes follow the available bank order before mixed review'
  );
  for (const quiz of bank.quizzes) {
    assert.match(
      page.$(`[data-start-quiz="${quiz.id}"]`).closest('.quiz-card').textContent,
      new RegExp(`${quiz.questions.length} questions`)
    );
  }
  const mixedReview = page.$('[data-start-quiz="mixed-review"]');
  const history = catalogue.querySelector('.quiz-history');
  assert.ok(history.compareDocumentPosition(mixedReview) & 2, 'recent attempts follow mixed review');
  assert.match(history.textContent, /No attempts yet/);
  const unavailable = catalogue.querySelectorAll('.quiz-unavailable-card');
  assert.equal(unavailable.length, 8);
  for (const topic of unavailable) {
    assert.equal(topic.querySelector('[data-start-quiz]'), null, 'unavailable topics have no quiz actions');
  }
  page.done();
});

test('assessment: checkpoint submits and shows a review', async () => {
  const page = await openPage('pages/assessments.html');
  const overview = page.$('.assessment-page');
  assert.ok(overview, 'the checkpoint overview is shown before starting');
  assert.match(overview.textContent, /15 available questions/);
  assert.match(overview.textContent, /untimed/i);
  assert.match(overview.textContent, /not a course grade/i);
  assert.equal(page.$$('.assessment-page [data-start-assessment]').length, 1);
  page.click('[data-start-assessment]');
  for (let question = 0; question < 15; question += 1) {
    page.choose('[data-learning-answer]');
    assert.doesNotMatch(page.text(), /Correct\.|Not quite\./, 'answer feedback stays hidden during the checkpoint');
    page.click('[data-learning-next]');
  }
  assert.ok(page.$('#assessment-results-heading'), 'assessment results heading');
  assert.match(page.text(), /Your XP and lesson progress have not changed/);
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.completions?.some((completion) => completion.type === 'checkpoint'),
    'checkpoint completion to persist'
  );
  page.click('[data-restart-assessment]');
  assert.match(page.text(), /Question 1 of 15/);
  page.done();
});

test('quizzes: a quiz saves an attempt to guest history', async () => {
  const page = await openPage('pages/quizzes.html');
  page.click('[data-start-quiz="logic-truth-tables"]');
  for (let question = 0; question < 5; question += 1) {
    page.choose('[data-quiz-answer]');
    page.click('[data-quiz-check]');
    page.click('[data-quiz-next]');
  }
  await page.until(() => /Attempt saved/.test(page.text()), 'the attempt to be saved');
  assert.equal(page.storage('dfh:quiz-attempts').length, 1);
  assert.equal(page.storage('dfh:quiz-attempts')[0].mode, 'logic-truth-tables');
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.completions?.some((completion) => completion.type === 'quiz'),
    'quiz completion to persist'
  );
  page.done();
});

test('quizzes: missed question IDs stay local when signed-in history cannot save', async () => {
  const session = { user: { id: 'quiz-activity-user', email: 'student@example.com' } };
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    from(table) {
      let inserting = false;
      const result = {
        data: table === 'profiles'
          ? { nickname: 'Learner', xp: 0, level: 1, streak: 0, last_active: null }
          : [],
        error: null
      };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        is: () => Promise.resolve({ ...result, count: 0 }),
        single: () => Promise.resolve(inserting
          ? { data: null, error: new Error('network unavailable') }
          : result),
        update: () => chain,
        upsert: async () => ({ error: null }),
        insert: () => { inserting = true; return chain; },
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      };
      return chain;
    }
  };
  const originalRandom = Math.random;
  Math.random = () => 0;
  const page = await openPage('pages/quizzes.html', {
    seed: savedAuthToken,
    supabase: { createClient: () => client }
  });
  try {
    page.click('[data-start-quiz="logic-truth-tables"]');
    for (let question = 0; question < 5; question += 1) {
      page.choose('[data-quiz-answer][value="0"]');
      page.click('[data-quiz-check]');
      page.click('[data-quiz-next]');
    }
    await page.until(() => /could not save this attempt/i.test(page.text()), 'the failed remote save message');
    await page.until(
      () => page.storage('dfh:dashboard-activity:user:quiz-activity-user')?.recentEvents?.length === 1,
      'local quiz activity'
    );
    const [attempt] = page.storage('dfh:dashboard-activity:user:quiz-activity-user').recentEvents;
    assert.equal(attempt.type, 'quiz-attempt');
    assert.equal(attempt.mode, 'logic-truth-tables');
    assert.ok(attempt.missedQuestionIds.length > 0, 'missed question IDs are retained locally');
    assert.ok(attempt.missedQuestionIds.every((id) => typeof id === 'string'));
  } finally {
    Math.random = originalRandom;
    page.done(['Could not save quiz attempt.']);
  }
});

test('flashcards: single-card focus keeps deck controls with the active prompt', async () => {
  const page = await openPage('pages/flashcards.html');
  const focus = page.$('.flashcard-focus');
  assert.ok(focus, 'Flashcards content uses a focused study surface');
  assert.equal(focus.querySelectorAll('.flashcard-panel').length, 1, 'one current card is shown');
  assert.equal(focus.querySelectorAll('.flashcard-choices li').length, 4, 'the current card keeps its four choices');
  assert.equal(focus.querySelector('[role="status"]').textContent, 'Card 1 of 15');
  assert.equal(focus.querySelector('[data-flashcard-previous]').disabled, true, 'Previous is disabled on the first card');
  assert.ok(focus.querySelector('[data-flashcard-reveal]'), 'the answer can be revealed');
  assert.ok(focus.querySelector('[data-flashcard-next]'), 'the next card remains available');
  page.done();
});

test('flashcards: reveal and move through the deck', async () => {
  const page = await openPage('pages/flashcards.html');
  assert.match(page.text(), /Card 1 of 15/);
  const cardId = page.$('.flashcard-panel').dataset.flashcardId;
  assert.ok(cardId, 'the flashcard panel identifies the current question');
  page.click('[data-flashcard-reveal]');
  assert.equal(page.$('[data-flashcard-answer]').hasAttribute('hidden'), false);
  page.click('[data-flashcard-reveal]');
  page.click('[data-flashcard-reveal]');
  await page.until(
    () => page.storage('dfh:dashboard-activity:guest')?.today?.flashcardIds.length === 1,
    'flashcard reveal activity'
  );
  await page.until(
    () => page.storage('dfh:dashboard-activity:guest')?.recentEvents?.filter((event) => event.type === 'flashcard-revealed').length === 2,
    'both flashcard reveal events'
  );
  const flashcardActivity = page.storage('dfh:dashboard-activity:guest');
  assert.deepEqual(flashcardActivity.today.flashcardIds, [cardId], 'revealing a card repeatedly counts once toward the daily goal');
  assert.equal(
    page.storage('dfh:learner-events:guest').events.filter((event) => event.type === 'flashcard-reviewed' && event.data.cardId === cardId).length,
    1,
    'a card is counted once per study session'
  );
  page.click('[data-flashcard-next]');
  assert.match(page.text(), /Card 2 of 15/);
  page.done();
});

test('study tracking: page visit persists and pagehide flushes active time', async () => {
  const page = await openPage('pages/lessons.html');
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.events?.some((event) => event.type === 'page-visited' && event.data.page === 'lessons'),
    'lesson page visit to persist'
  );
  await sleep(1100);
  page.window.dispatchEvent(new page.window.Event('pagehide'));
  await page.until(
    () => page.storage('dfh:study-sessions:guest')?.length === 1,
    'study session to flush on pagehide'
  );
  assert.ok(page.storage('dfh:study-sessions:guest')[0].durationSeconds > 0);
  page.done();
});

test('notifications: guests see and can dismiss a new achievement update', async () => {
  const page = await openPage('pages/lessons.html');
  await page.until(
    () => page.storage('dfh:guest-achievements')?.notifications?.some((notification) => notification.achievementId === 'first-step'),
    'the first lesson achievement notification'
  );
  assert.ok(page.$('[data-achievement-feedback]'), 'an immediate achievement dialog is shown');
  page.click('[data-close-achievement]');
  page.click('[data-notifications-toggle]');
  await page.until(() => !page.$('#notification-panel').hidden, 'the notification history to open');
  assert.match(page.$('[data-notification-list]').textContent, /First Step/);
  page.click('[data-notification-read]');
  await page.until(() => page.$('[data-notification-count]').hidden, 'the unread count to clear');
  assert.equal(page.storage('dfh:guest-achievements').notifications[0].readAt !== null, true);
  page.done();
});

test('lesson: focused reader keeps pathway and section outline in the reading flow', async () => {
  const page = await openPage('pages/lessons.html', { search: '?lesson=logic-truth-tables' });
  const reader = page.$('.lesson-reader-layout');
  assert.ok(reader, 'lesson content uses the focused reading layout');
  const pathway = reader.querySelector('.lesson-pathway');
  assert.equal(pathway.querySelectorAll('a').length, 3, 'all Logic lessons remain available in the pathway');
  for (const lessonId of ['logic-propositions', 'logic-truth-tables', 'logic-predicates']) {
    assert.ok(pathway.querySelector(`a[href*="${lessonId}"]`), `${lessonId} remains linked from the pathway`);
  }
  assert.ok(
    pathway.querySelector('a[aria-current="page"][href*="logic-truth-tables"]'),
    'the selected lesson is identified as the current page'
  );
  assert.ok(reader.querySelector('.lesson-outline a[href="#lesson-section-1"]'), 'the outline links to lesson sections');
  assert.ok(reader.querySelector('[data-complete]'), 'lesson completion remains available');
  assert.equal(reader.querySelector('.lesson-rail-rich'), null, 'the reader no longer has a separate lesson rail');
  assert.equal(reader.querySelector('.answer').hidden, true, 'the self-check explanation starts hidden');
  page.click('[data-reveal]');
  assert.equal(reader.querySelector('.answer').hidden, false, 'the self-check explanation can be revealed');
  page.done();
});

test('lesson: completing a lesson awards XP once', async () => {
  const page = await openPage('pages/lessons.html', { search: '?lesson=logic-truth-tables' });
  page.click('[data-complete]');
  await page.until(() => page.storage('dfh:learner-state')?.xp === 50, 'XP to be saved');
  assert.deepEqual(page.storage('dfh:learner-state').completedLessons, ['logic-truth-tables']);
  await page.until(
    () => page.storage('dfh:dashboard-activity:guest')?.today.lessonIds.length === 1,
    'lesson completion activity'
  );
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.completions?.length === 1,
    'one timed lesson completion'
  );
  assert.equal(page.storage('dfh:dashboard-activity:guest').recentEvents[0].id, 'logic-truth-tables');
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.completions?.some((completion) => completion.type === 'lesson' && completion.activityId === 'logic-truth-tables'),
    'timed lesson completion to persist'
  );
  page.click('[data-complete]');
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.completions?.length === 1,
    'repeat completion click to stay idempotent'
  );
  assert.match(page.$('[data-complete]').textContent, /Completed/);
  page.done();
});

test('lesson: the truth-table explorer responds to the switches', async () => {
  const page = await openPage('pages/lessons.html', { search: '?lesson=logic-propositions' });
  const widget = page.$('[data-widget="truth-table"]');
  assert.ok(widget, 'the explorer is on the page');
  await page.until(() => widget.dataset.ready === 'true', 'the explorer to start');
  const value = (id) => widget.querySelector(`[data-result="${id}"]`).textContent.trim();
  assert.equal(value('implies'), 'True');
  widget.querySelector('[data-var="p"]').click();
  assert.equal(widget.querySelector('[data-var="p"]').getAttribute('aria-pressed'), 'false');
  assert.equal(value('implies'), 'True');
  widget.querySelector('[data-var="q"]').click();
  assert.equal(value('implies'), 'True');
  assert.equal(value('and'), 'False');
  widget.querySelector('[data-var="p"]').click();
  assert.equal(value('implies'), 'False');
  assert.equal(widget.querySelectorAll('tr[aria-current="true"]').length, 1);
  page.done();
});

test('profile: saving a nickname updates the page', async () => {
  const page = await openPage('pages/profile.html');
  const input = page.$('#profile-nickname'); input.value = 'Kian Reyes';
  page.$('[data-profile-form]').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => /Profile settings saved/.test(page.text()), 'the profile settings to save');
  assert.equal(page.storage('dfh:learner-state').nickname, 'Kian Reyes');
  await page.until(
    () => page.storage('dfh:learner-events:guest')?.events?.some((event) => event.type === 'nickname-changed'),
    'nickname change to be recorded'
  );
  page.done();
});

test('profile: saves preferences and applies appearance settings', async () => {
  const page = await openPage('pages/profile.html');
  const form = page.$('[data-profile-form]');
  form.elements.nickname.value = 'Kian Reyes';
  form.elements.program.value = 'BS Information Technology';
  form.elements.yearLevel.value = '2nd year';
  form.elements.weeklyGoal.value = '4';
  form.elements.sessionLength.value = '40';
  form.elements.preferredTime.value = 'evening';
  form.elements.lessonStyle.value = 'practice-first';
  form.elements.studyReminders.checked = true;
  form.elements.assessmentUpdates.checked = true;
  form.elements.theme.value = 'dark';
  form.elements.reduceMotion.checked = true;
  form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => /Profile settings saved/.test(page.text()), 'profile settings to save');

  assert.deepEqual(page.storage('dfh:profile-preferences'), {
    program: 'BS Information Technology',
    yearLevel: '2nd year',
    weeklyGoal: 4,
    sessionLength: 40,
    preferredTime: 'evening',
    lessonStyle: 'practice-first',
    studyReminders: true,
    assessmentUpdates: true,
    reduceMotion: true
  });
  assert.equal(page.storage('dfh:learner-state').nickname, 'Kian Reyes');
  assert.equal(page.storage('dfh:learner-state').theme, 'dark');
  assert.equal('profilePreferences' in page.storage('dfh:learner-state'), false);
  assert.equal(page.$('.profile-summary h2').textContent, 'Kian Reyes');
  assert.equal(page.$('.profile-avatar').textContent, 'K');
  assert.equal(form.elements.program.value, 'BS Information Technology');
  assert.equal(form.elements.yearLevel.value, '2nd year');
  assert.equal(page.window.document.documentElement.dataset.theme, 'dark');
  assert.equal(page.window.document.documentElement.dataset.reduceMotion, 'true');
  page.done();
});

test('profile: invalid nickname prevents all profile changes', async () => {
  const page = await openPage('pages/profile.html');
  const initialState = page.storage('dfh:learner-state');
  const initialPreferences = page.storage('dfh:profile-preferences');
  const form = page.$('[data-profile-form]');
  form.elements.nickname.value = 'x';
  form.elements.theme.value = 'dark';
  form.elements.reduceMotion.checked = true;
  form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));

  assert.equal(page.$('#profile-nickname').getAttribute('aria-invalid'), 'true');
  assert.match(page.$('#profile-nickname-error').textContent, /3–32/);
  assert.deepEqual(page.storage('dfh:learner-state'), initialState);
  assert.deepEqual(page.storage('dfh:profile-preferences'), initialPreferences);
  assert.equal(page.window.document.documentElement.dataset.theme, 'light');
  assert.notEqual(page.window.document.documentElement.dataset.reduceMotion, 'true');
  page.done();
});

test('profile: applies saved reduced motion on initialization', async () => {
  const page = await openPage('pages/profile.html', {
    seed: { 'dfh:profile-preferences': { reduceMotion: true } }
  });
  assert.equal(page.window.document.documentElement.dataset.reduceMotion, 'true');
  page.done();
});

test('dashboard: compact study-first layout keeps the primary path before supporting panels', async () => {
  const page = await openPage('pages/dashboard.html');
  const selectors = [
    '.dashboard-welcome',
    '.dashboard-next-step',
    '.dashboard-overview',
    '.dashboard-pathway',
    '.dashboard-study-tools',
    '.dashboard-supporting'
  ];
  const sections = selectors.map((selector) => page.$(selector));
  assert.ok(sections.every(Boolean), 'all study-first Dashboard sections are present');
  for (let index = 1; index < sections.length; index += 1) {
    assert.ok(
      sections[index - 1].compareDocumentPosition(sections[index]) & page.window.Node.DOCUMENT_POSITION_FOLLOWING,
      `${selectors[index - 1]} appears before ${selectors[index]}`
    );
  }
  assert.match(page.text(), /Your first lesson is ready/);
  assert.ok(page.$('.dashboard-supporting [data-dashboard-goal]'), 'daily goal remains available in supporting content');
  page.done();
});

test('dashboard: full course map stays after the study-first sections', async () => {
  const page = await openPage('pages/dashboard.html');
  const courseMap = page.$('.dashboard-course-map');
  const supporting = page.$('.dashboard-supporting');
  assert.ok(courseMap, 'all course topics remain available on the Dashboard');
  assert.ok(
    supporting.compareDocumentPosition(courseMap) & page.window.Node.DOCUMENT_POSITION_FOLLOWING,
    'the course map follows the primary path and supporting details'
  );
  assert.equal(courseMap.querySelectorAll('.mini-topic').length, 9);
  assert.match(courseMap.textContent, /Logic/);
  assert.match(courseMap.textContent, /Coming soon/);
  page.done();
});

test('dashboard: completed Logic pathway keeps its review action', async () => {
  const page = await openPage('pages/dashboard.html', {
    seed: {
      'dfh:learner-state': {
        completedLessons: ['logic-propositions', 'logic-truth-tables', 'logic-predicates'],
        xp: 150,
        level: 2
      }
    }
  });
  const nextStep = page.$('.dashboard-next-step');
  assert.ok(nextStep, 'the completed pathway is in the next-step section');
  assert.match(nextStep.textContent, /All Logic lessons complete/);
  assert.match(nextStep.querySelector('a').getAttribute('href'), /quizzes/);
  page.done();
});

test('dashboard: daily goal selection persists locally', async () => {
  const page = await openPage('pages/dashboard.html');
  const goal = page.$('[data-dashboard-goal]');
  assert.ok(goal, 'daily goal has a selectable control');
  assert.match(page.text(), /0 of 1 lesson/);
  goal.value = 'flashcards';
  goal.dispatchEvent(new page.window.Event('change', { bubbles: true }));
  await page.until(
    () => page.storage('dfh:dashboard-activity:guest')?.goal === 'flashcards',
    'daily goal to persist'
  );
  assert.match(page.text(), /0 of 10 cards/);
  assert.match(page.text(), /No current announcements or deadlines/);
  page.done();
});

test('signed-in dashboard fills the leaderboard after the first paint', async () => {
  const session = { user: { id: 'user-1', email: 'student@example.com' } };
  const rows = { profiles: { nickname: 'Kian', xp: 100, level: 1, streak: 2, last_active: '2026-11-12' }, lesson_progress: [{ lesson_id: 'logic-propositions' }, { lesson_id: 'logic-truth-tables' }], quiz_attempts: [], leaderboard: [{ nickname: 'Ana', xp: 150 }, { nickname: 'Kian', xp: 100 }], notifications: [] };
  const query = (table) => {
    const result = { data: rows[table], error: null, count: 0 };
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, is: () => Promise.resolve(result), single: () => Promise.resolve(result), insert: () => Promise.resolve({ error: null }), upsert: () => Promise.resolve({ error: null }), update: () => chain, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    return chain;
  };
  const client = { auth: { getSession: async () => ({ data: { session }, error: null }) }, from: query };
  const page = await openPage('pages/dashboard.html', {
    seed: { [`sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`]: { access_token: 'x' } },
    supabase: { createClient: () => client }
  });
  await page.until(() => page.$$('.leaderboard-list li').length === 2, 'the leaderboard rows');
  assert.match(page.text(), /student@example\.com/);
  assert.match(page.text(), /Ana/);
  page.done();
});

const child = process.env.SMOKE_CHILD;
if (child) {
  // Child process: run exactly one test in a fresh module graph.
  const entry = tests.find(([name]) => name === child);
  try { await entry[1](); if (problems.length) throw new Error(problems.join(' | ')); console.log(`ok   ${child}`); process.exit(0); }
  catch (error) { console.log(`FAIL ${child}\n     ${String(error.message).split('\n')[0]}`); process.exit(1); }
}

// Parent process: run each test in its own process, four at a time.
const only = process.env.ONLY;
const names = tests.map(([name]) => name).filter((name) => !only || name.includes(only));
const results = new Map();
let next = 0;
async function worker() {
  while (next < names.length) {
    const name = names[next]; next += 1;
    const output = await new Promise((done) => {
      execFile(process.execPath, [import.meta.filename], { env: { ...process.env, SMOKE_CHILD: name }, timeout: 60000 }, (error, stdout) => done(stdout || `FAIL ${name}\n     ${error?.message || 'no output'}`));
    });
    results.set(name, output.trim());
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
let failed = 0;
for (const name of names) { const line = results.get(name); if (line.startsWith('FAIL')) failed += 1; console.log(line); }
console.log(failed ? `\n${failed} of ${names.length} smoke tests failed.` : `\nAll ${names.length} smoke tests passed.`);
process.exit(failed ? 1 : 0);
