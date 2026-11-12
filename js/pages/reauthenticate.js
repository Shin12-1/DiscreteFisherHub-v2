import { initialiseAuth, requestReauthentication, verifyReauthenticationCode } from '../core/auth.js';
import { validateOtpField } from '../core/auth-validation.mjs';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');
let userEmail = '';

function renderSignedOut() {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Sign in to verify your identity.</h1>
    <p class="form-error" role="alert">Sign in before requesting an identity-verification code.</p>
    <a class="button button-primary" href="login.html">Go to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

function renderRequest(error = '') {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Verify your identity.</h1>
    <p>We’ll send a one-time verification code to <strong>${escapeHtml(userEmail)}</strong>.</p>
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <button class="button button-primary" type="button" data-send-reauthentication>Send verification code</button>
    <a class="text-button" href="profile.html">Back to profile</a>
  `;
  app.querySelector('[data-send-reauthentication]').addEventListener('click', sendCode);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

function renderCode({ message = '', error = '', fieldError = '' } = {}) {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Enter your verification code.</h1>
    <p>Check ${escapeHtml(userEmail)} for the one-time code.</p>
    ${message ? `<p data-auth-status class="form-message" role="status">${escapeHtml(message)}</p>` : ''}
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <form id="reauthentication-form" novalidate>
      <div class="field">
        <label for="token">Verification code</label>
        <input id="token" name="token" type="text" inputmode="numeric" autocomplete="one-time-code" aria-describedby="${fieldError ? 'token-error' : ''}" ${fieldError ? 'aria-invalid="true"' : ''} required>
        ${fieldError ? `<small id="token-error" class="field-error">${escapeHtml(fieldError)}</small>` : ''}
      </div>
      <button class="button button-primary" type="submit">Verify identity</button>
    </form>
    <a class="text-button" href="profile.html">Back to profile</a>
  `;
  app.querySelector('#reauthentication-form').addEventListener('submit', verifyCode);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

function renderSuccess() {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Identity verified.</h1>
    <p data-auth-status class="form-message" role="status">Your identity is verified.</p>
    <a class="button button-primary" href="profile.html">Return to profile</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

async function sendCode(event) {
  const button = event.currentTarget;
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    await requestReauthentication();
    renderCode({ message: 'If Supabase accepts the request, a verification code will arrive shortly.' });
  } catch (error) {
    renderRequest(error.message || 'We could not send a verification code. Please try again.');
  }
}

async function verifyCode(event) {
  event.preventDefault();
  const token = String(new FormData(event.currentTarget).get('token') || '').trim();
  const fieldError = validateOtpField(token);
  if (fieldError) {
    renderCode({ fieldError });
    app.querySelector('#token')?.focus();
    return;
  }

  const button = event.currentTarget.querySelector('[type="submit"]');
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Verifying…';
  try {
    await verifyReauthenticationCode(userEmail, token);
    renderSuccess();
  } catch (error) {
    renderCode({ error: error.message || 'That code is invalid or has expired. Request a new code.' });
  }
}

app.setAttribute('aria-busy', 'true');
try {
  const session = await initialiseAuth();
  if (!session?.user?.email) renderSignedOut();
  else {
    userEmail = session.user.email;
    renderRequest();
  }
} catch {
  renderSignedOut();
}
