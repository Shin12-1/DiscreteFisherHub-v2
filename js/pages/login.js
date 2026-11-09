import { initialiseAuth, isSupabaseConfigured, resendSignupConfirmation, signIn, signUp } from '../core/auth.js';
const app = document.querySelector('#login-app');
const dashboard = '../pages/dashboard.html';
let mode = 'login';
let pendingConfirmationEmail = '';
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function render(message = '', error = '') {
  const signup = mode === 'signup';
  app.innerHTML = `<p class="tag">${signup ? 'Create your study profile' : 'Sign in to sync progress'}</p><h1>${signup ? 'Start your learning record.' : 'Welcome back.'}</h1><p>Guest progress remains available on this device. Signing in syncs lesson completion securely.</p>${!isSupabaseConfigured() ? '<p class="form-message" role="status">Supabase is not configured yet. You can continue learning as a guest.</p>' : ''}<form id="auth-form" novalidate><div class="field">${signup ? '<label for="nickname">Nickname</label><input id="nickname" name="nickname" autocomplete="nickname" maxlength="32" required>' : ''}</div><div class="field"><label for="email">FVC email</label><input id="email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required></div>${error ? `<p class="form-error" role="alert">${escapeHtml(error)}</p>` : ''}${message ? `<p class="form-message" role="status">${escapeHtml(message)}</p>` : ''}<button class="button button-primary" type="submit">${signup ? 'Create account' : 'Log in'}</button></form><button class="text-button" data-switch>${signup ? 'Already have an account? Log in' : 'Need an account? Sign up'}</button>${pendingConfirmationEmail && !signup ? '<button class="text-button" data-resend type="button">Resend confirmation email</button>' : ''}<a class="button button-secondary" href="${dashboard}">Continue as guest</a>`;
  app.querySelector('[data-switch]').addEventListener('click', () => { mode = signup ? 'login' : 'signup'; render(); });
  app.querySelector('#auth-form').addEventListener('submit', submit);
  app.querySelector('[data-resend]')?.addEventListener('click', resendConfirmation);
}
async function submit(event) {
  event.preventDefault();
  const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); const fields = Object.fromEntries(new FormData(form));
  button.disabled = true; button.textContent = 'Please wait…';
  try {
    const signingUp = mode === 'signup';
    const result = signingUp ? await signUp(fields) : await signIn(fields);
    if (result?.needsEmailConfirmation) {
      pendingConfirmationEmail = fields.email.trim();
      mode = 'login';
      render(`Confirmation email sent to ${pendingConfirmationEmail}. Verify your email, then log in. Check your spam folder if it does not arrive.`);
    } else {
      pendingConfirmationEmail = '';
      location.assign(dashboard);
    }
  } catch (error) {
    render('', error.message || 'We could not complete that request. Please try again.');
  }
}
async function resendConfirmation(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    await resendSignupConfirmation(pendingConfirmationEmail);
    render(`A new confirmation email was sent to ${pendingConfirmationEmail}.`);
  } catch (error) {
    render('', error.message || 'We could not resend the confirmation email. Please try again.');
  }
}
try { const session = await initialiseAuth(); if (session) location.assign(dashboard); else render(); } catch (error) { render('', 'Could not connect to Supabase. You can still continue as a guest.'); }
