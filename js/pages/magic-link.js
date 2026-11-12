import { isAuthCallbackRequest, sendMagicLink, verifyEmailOtp, waitForAuthCallback } from '../core/auth.js';
import { validateOtpField, validatePasswordResetEmail } from '../core/auth-validation.mjs';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');
let emailValue = '';

function renderRequest({ message = '', error = '', emailError = '', showOtp = false, tokenError = '' } = {}) {
  app.innerHTML = `
    <p class="tag">Email sign-in</p>
    <h1>Sign in with your email.</h1>
    <p>We’ll send a secure sign-in link and verification code to your inbox.</p>
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <form id="magic-link-form" novalidate>
      <div class="field">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" autocomplete="email" value="${escapeHtml(emailValue)}" aria-describedby="email-help${emailError ? ' email-error' : ''}" ${emailError ? 'aria-invalid="true"' : ''} required>
        <small id="email-help">Use the email address linked to your study account.</small>
        ${emailError ? `<small id="email-error" class="field-error">${escapeHtml(emailError)}</small>` : ''}
      </div>
      <button class="button button-primary" type="submit">Send sign-in link</button>
    </form>
    ${message ? `<p data-auth-status class="form-message" role="status">${escapeHtml(message)}</p>` : ''}
    ${showOtp ? `
      <form id="otp-form" novalidate>
        <div class="field">
          <label for="otp-email">Email address</label>
          <input id="otp-email" name="email" type="email" autocomplete="email" value="${escapeHtml(emailValue)}" required>
        </div>
        <div class="field">
          <label for="token">Verification code</label>
          <input id="token" name="token" type="text" inputmode="numeric" autocomplete="one-time-code" aria-describedby="${tokenError ? 'token-error' : ''}" ${tokenError ? 'aria-invalid="true"' : ''} required>
          ${tokenError ? `<small id="token-error" class="field-error">${escapeHtml(tokenError)}</small>` : ''}
        </div>
        <button class="button button-secondary" type="submit">Verify code</button>
      </form>
    ` : ''}
    <a class="text-button" href="login.html">Back to password login</a>
  `;
  app.querySelector('#magic-link-form').addEventListener('submit', requestLink);
  app.querySelector('#otp-form')?.addEventListener('submit', verifyCode);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

function renderSuccess() {
  app.innerHTML = `
    <p class="tag">Email sign-in</p>
    <h1>You’re signed in.</h1>
    <p data-auth-status class="form-message" role="status">Your email was verified and you are signed in.</p>
    <a class="button button-primary" href="dashboard.html">Continue to your study space</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

function renderInvalidLink() {
  app.innerHTML = `
    <p class="tag">Email sign-in</p>
    <h1>Sign-in link unavailable.</h1>
    <p class="form-error" role="alert" tabindex="-1">This sign-in link is invalid or has expired. Request a new link to continue.</p>
    <a class="button button-primary" href="magic-link.html">Request another link</a>
    <a class="text-button" href="login.html">Back to password login</a>
  `;
  app.setAttribute('aria-busy', 'false');
  app.querySelector('[role="alert"]')?.focus();
}

async function requestLink(event) {
  event.preventDefault();
  const email = String(new FormData(event.currentTarget).get('email') || '').trim();
  emailValue = email;
  const emailError = validatePasswordResetEmail(email);
  if (emailError) {
    renderRequest({ emailError });
    app.querySelector('#email')?.focus();
    return;
  }

  const button = event.currentTarget.querySelector('[type="submit"]');
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    await sendMagicLink(emailValue);
    renderRequest({
      message: 'If an account exists for that address, a sign-in link and code will arrive shortly. Check your inbox and spam folder.',
      showOtp: true
    });
  } catch (error) {
    renderRequest({ error: error.message || 'We could not send a sign-in link. Please try again.' });
  }
}

async function verifyCode(event) {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  emailValue = String(fields.email || '').trim();
  const emailError = validatePasswordResetEmail(emailValue);
  const tokenError = validateOtpField(fields.token);
  if (emailError || tokenError) {
    renderRequest({ showOtp: true, emailError, tokenError });
    app.querySelector(emailError ? '#email' : '#token')?.focus();
    return;
  }

  const button = event.currentTarget.querySelector('[type="submit"]');
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Verifying…';
  try {
    const session = await verifyEmailOtp(emailValue, String(fields.token));
    if (!session) throw new Error('Verification did not sign you in. Request a new link and try again.');
    renderSuccess();
  } catch (error) {
    renderRequest({
      error: error.message || 'That code is invalid or has expired. Request a new sign-in link.',
      showOtp: true
    });
  }
}

app.setAttribute('aria-busy', 'true');
if (isAuthCallbackRequest()) {
  try {
    const session = await waitForAuthCallback();
    if (session) renderSuccess();
    else renderInvalidLink();
  } catch {
    renderInvalidLink();
  }
} else {
  renderRequest();
}
