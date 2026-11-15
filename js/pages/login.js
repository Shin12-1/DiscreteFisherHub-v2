import { initialiseAuth, isSupabaseConfigured, resendSignupConfirmation, signIn, signInWithGoogle, signUp } from '../core/auth.js';
import { validateAuthFields } from '../core/auth-validation.mjs';
import { renderPageSkeleton } from '../components/loading.js';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#login-app');
const dashboard = '../pages/dashboard.html';
let mode = 'login';
let emailValue = '';


function render(message = '', error = '', fieldErrors = {}, showResend = false) {
  const signup = mode === 'signup';
  const resendButton = !signup && showResend && isSupabaseConfigured()
    ? '<button class="text-button" data-resend type="button">Resend confirmation email</button>'
    : '';
  const fieldError = (name) => fieldErrors[name]
    ? `<small id="${name}-error" class="field-error">${escapeHtml(fieldErrors[name])}</small>`
    : '';
  const describedBy = (name, help) => [help, fieldErrors[name] ? `${name}-error` : ''].filter(Boolean).join(' ');
  const hasErrors = Boolean(error || Object.keys(fieldErrors).length);

  app.innerHTML = `
    <p class="tag">${signup ? 'Create your study profile' : 'Sign in to sync progress'}</p>
    <h1>${signup ? 'Start your learning record.' : 'Welcome back.'}</h1>
    <p>Guest progress remains available on this device. Signing in syncs lesson completion securely.</p>
    ${!isSupabaseConfigured() ? '<p class="form-message" role="status">Supabase is not configured yet. You can continue learning as a guest.</p>' : ''}
    ${hasErrors ? `<div id="auth-errors" class="form-error auth-error-summary" role="alert" tabindex="-1">${escapeHtml(error || 'Please review the highlighted fields and try again.')}</div>` : ''}
    <form id="auth-form" novalidate>
      <div class="field">
        ${signup ? `<label for="nickname">Nickname</label><input id="nickname" name="nickname" autocomplete="nickname" minlength="3" maxlength="32" aria-describedby="${describedBy('nickname', 'nickname-help')}" ${fieldErrors.nickname ? 'aria-invalid="true"' : ''} required><small id="nickname-help">3–32 letters, numbers, spaces, dots, hyphens, or underscores.</small>${fieldError('nickname')}` : ''}
      </div>
      <div class="field">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" autocomplete="email" placeholder="example@gmail.com" value="${escapeHtml(emailValue)}" aria-describedby="${describedBy('email', 'email-help')}" ${fieldErrors.email ? 'aria-invalid="true"' : ''} required>
        <small id="email-help">Use the email address linked to your study account.</small>${fieldError('email')}
      </div>
      <div class="field">
        <div class="auth-password-heading">
          <label for="password">Password</label>
          ${!signup ? '<a class="text-button" data-forgot-password href="forgot-password.html">Forgot password?</a>' : ''}
        </div>
        <div class="auth-password-input">
          <input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" aria-describedby="${describedBy('password', 'password-help')}" ${fieldErrors.password ? 'aria-invalid="true"' : ''} required>
          <button class="auth-password-toggle" data-password-toggle type="button" aria-controls="password" aria-label="Show password" aria-pressed="false">Show</button>
        </div>
        <small id="password-help">At least 8 characters.</small>${fieldError('password')}
      </div>
      ${message ? `<p class="form-message" role="status">${escapeHtml(message)}</p>` : ''}
      <button class="button button-primary" type="submit">${signup ? 'Create account' : 'Log in'}</button>
    </form>
    ${isSupabaseConfigured() ? '<div class="auth-provider-divider"><span>or</span></div><button class="button button-secondary auth-provider-button" data-google-sign-in type="button"><span class="auth-provider-mark" aria-hidden="true">G</span>Continue with Google</button>' : ''}
    <p class="auth-signup-prompt">
      <span>${signup ? 'Already have an account?' : 'New here?'}</span>
      <button class="text-button" data-switch type="button">${signup ? 'Log in' : 'Sign up'}</button>
    </p>
    ${resendButton}
    <a class="button button-secondary" data-guest-link href="${dashboard}">Continue as guest</a>
  `;

  app.querySelector('[data-switch]').addEventListener('click', () => {
    mode = signup ? 'login' : 'signup';
    render();
  });
  app.querySelector('#auth-form').addEventListener('submit', submit);
  app.querySelector('[data-password-toggle]').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const password = app.querySelector('#password');
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} password`);
    button.setAttribute('aria-pressed', String(visible));
  });
  app.querySelector('[data-google-sign-in]')?.addEventListener('click', signInGoogle);
  app.querySelector('[data-resend]')?.addEventListener('click', resendConfirmation);
  app.setAttribute('aria-busy', 'false');
  if (hasErrors) app.querySelector('#auth-errors')?.focus();
}

async function signInGoogle(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Connecting…';
  try {
    await signInWithGoogle();
  } catch (error) {
    render('', error.message || 'We could not start Google sign-in. Please try again.');
  }
}

async function submit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const fields = Object.fromEntries(new FormData(form));
  const signingUp = mode === 'signup';

  emailValue = String(fields.email || '').trim();
  const fieldErrors = validateAuthFields(fields, mode);
  if (Object.keys(fieldErrors).length) {
    render('', '', fieldErrors);
    return;
  }
  form.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Please wait…';

  try {
    const result = signingUp ? await signUp(fields) : await signIn(fields);
    if (result?.needsEmailConfirmation) {
      mode = 'login';
      render('If confirmation is required, check your inbox and spam folder for an email from Supabase before logging in.', '', {}, true);
      return;
    }

    emailValue = '';
    location.assign(dashboard);
  } catch (error) {
    const showResend = ['email_not_confirmed', 'email_confirmation_pending'].includes(error.code);
    if (error.code === 'email_confirmation_pending') mode = 'login';
    render('', error.message || 'We could not complete that request. Please try again.', {}, showResend);
  }
}

async function resendConfirmation(event) {
  const email = app.querySelector('[name="email"]').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    render('', 'Enter a valid email address before requesting another confirmation email.', {}, true);
    return;
  }

  emailValue = email;
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Sending…';

  try {
    await resendSignupConfirmation(email);
    render('If this address has an unconfirmed account, Supabase accepted a request to resend its confirmation email. Check your inbox and spam folder.', '', {}, true);
  } catch (error) {
    render('', error.message || 'We could not resend the confirmation email. Please try again.', {}, true);
  }
}

app.innerHTML = renderPageSkeleton('login');
app.setAttribute('aria-busy', 'true');

try {
  const session = await initialiseAuth();
  if (session) location.assign(dashboard);
  else render();
} catch {
  render('', 'Could not connect to Supabase. You can still continue as a guest.');
}
