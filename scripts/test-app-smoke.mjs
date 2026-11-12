// End-to-end smoke tests: load every real page module in a DOM (jsdom), click through
// the main flows, and fail on any thrown error or console.error. Run with `npm test`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { SUPABASE_URL } from '../js/config.js';

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
    done() { console.error = originalError; assert.deepEqual(errors, [], `console.error during ${file}: ${errors.join(' | ')}`); window.close(); }
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

function createSessionClient(session, authOverrides = {}, callbackEvent = null) {
  let authListener = null;
  const auth = {
    getSession: async () => {
      if (callbackEvent) authListener?.(callbackEvent, session);
      return { data: { session }, error: null };
    },
    onAuthStateChange: (listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe() { authListener = null; } } } };
    },
    ...authOverrides
  };
  return {
    auth,
    from(table) {
      const result = {
        data: table === 'profiles'
          ? { nickname: 'Learner', xp: 0, level: 1, streak: 0, last_active: null }
          : [],
        error: null
      };
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

test('login links to the password-recovery request page', async () => {
  const page = await openPage('pages/login.html');
  assert.equal(page.$('[data-forgot-password]')?.getAttribute('href'), 'forgot-password.html');
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

test('login links to the magic-link sign-in page', async () => {
  const page = await openPage('pages/login.html');
  assert.equal(page.$('[data-magic-link]')?.getAttribute('href'), 'magic-link.html');
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
  ['index.html', 'Build the reasoning'],
  ['pages/dashboard.html', 'Welcome back'],
  ['pages/courses.html', 'Learn one idea at a time'],
  ['pages/lessons.html', 'Propositions and connectives'],
  ['pages/flashcards.html', 'Flashcards for Logic'],
  ['pages/practice.html', 'Practice one idea at a time'],
  ['pages/quizzes.html', 'Check your understanding'],
  ['pages/assessments.html', 'Check what is sticking'],
  ['pages/progress.html', 'Progress you can understand'],
  ['pages/profile.html', 'Your study profile'],
  ['pages/login.html', 'Welcome back']
]) {
  test(`${file} renders without errors`, async () => {
    const page = await openPage(file);
    assert.ok(page.$('h1')?.textContent.includes(heading), `${file}: expected an h1 containing "${heading}"`);
    page.done();
  });
}

test('guests never load the Supabase client', async () => {
  const page = await openPage('pages/courses.html', { supabase: null });
  assert.equal(page.window.supabase, undefined);
  assert.equal(page.$$('script[src*="supabase"]').length, 0);
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

test('assessment: checkpoint submits and shows a review', async () => {
  const page = await openPage('pages/assessments.html');
  page.click('[data-start-assessment]');
  for (let question = 0; question < 15; question += 1) {
    page.choose('[data-learning-answer]');
    page.click('[data-learning-next]');
  }
  assert.ok(page.$('#assessment-results-heading'), 'assessment results heading');
  assert.match(page.text(), /Your XP and lesson progress have not changed/);
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
  page.done();
});

test('flashcards: reveal and move through the deck', async () => {
  const page = await openPage('pages/flashcards.html');
  assert.match(page.text(), /Card 1 of 15/);
  page.click('[data-flashcard-reveal]');
  assert.equal(page.$('[data-flashcard-answer]').hasAttribute('hidden'), false);
  page.click('[data-flashcard-next]');
  assert.match(page.text(), /Card 2 of 15/);
  page.done();
});

test('lesson: completing a lesson awards XP once', async () => {
  const page = await openPage('pages/lessons.html', { search: '?lesson=logic-truth-tables' });
  page.click('[data-complete]');
  await page.until(() => page.storage('dfh:learner-state')?.xp === 50, 'XP to be saved');
  assert.deepEqual(page.storage('dfh:learner-state').completedLessons, ['logic-truth-tables']);
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
  await page.until(() => /Nickname saved/.test(page.text()), 'the nickname to save');
  assert.equal(page.storage('dfh:learner-state').nickname, 'Kian Reyes');
  page.done();
});

test('signed-in dashboard fills the leaderboard after the first paint', async () => {
  const session = { user: { id: 'user-1', email: 'student@example.com' } };
  const rows = { profiles: { nickname: 'Kian', xp: 100, level: 1, streak: 2, last_active: '2026-11-12' }, lesson_progress: [{ lesson_id: 'logic-propositions' }, { lesson_id: 'logic-truth-tables' }], quiz_attempts: [], leaderboard: [{ nickname: 'Ana', xp: 150 }, { nickname: 'Kian', xp: 100 }] };
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, single: () => Promise.resolve(result), upsert: () => Promise.resolve({ error: null }), update: () => chain, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
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
