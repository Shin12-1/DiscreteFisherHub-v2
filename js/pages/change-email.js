import { initialiseAuth, isAuthCallbackRequest, requestEmailChange, waitForAuthCallback } from '../core/auth.js';
import { validatePasswordResetEmail } from '../core/auth-validation.mjs';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');

function renderSignedOut() {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Sign in to change your email.</h1>
    <p class="form-error" role="alert">Sign in to change your email address.</p>
    <a class="button button-primary" href="login.html">Go to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

function renderForm(email, { message = '', error = '', fieldError = '' } = {}) {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Change your email address.</h1>
    <p>We’ll ask you to confirm the new address. You may need to confirm from both email inboxes.</p>
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <form id="change-email-form" novalidate>
      <div class="field">
        <label for="email">New email address</label>
        <input id="email" name="email" type="email" autocomplete="email" value="${escapeHtml(email)}" aria-describedby="email-help${fieldError ? ' email-error' : ''}" ${fieldError ? 'aria-invalid="true"' : ''} required>
        <small id="email-help">Use an address you can access.</small>
        ${fieldError ? `<small id="email-error" class="field-error">${escapeHtml(fieldError)}</small>` : ''}
      </div>
      <button class="button button-primary" type="submit">Send confirmation emails</button>
    </form>
    ${message ? `<p data-auth-status class="form-message" role="status">${escapeHtml(message)}</p>` : ''}
    <a class="text-button" href="profile.html">Back to profile</a>
  `;
  app.querySelector('#change-email-form').addEventListener('submit', submit);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

function renderConfirmed() {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Email address updated.</h1>
    <p data-auth-status class="form-message" role="status">Your new email address has been confirmed.</p>
    <a class="button button-primary" href="profile.html">Return to profile</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

function renderUnavailable() {
  app.innerHTML = `
    <p class="tag">Account security</p>
    <h1>Email confirmation unavailable.</h1>
    <p class="form-error" role="alert">This email-change link is invalid or has expired. Request a new email change from your profile.</p>
    <a class="button button-primary" href="profile.html">Return to profile</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

async function submit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = String(new FormData(form).get('email') || '').trim();
  const fieldError = validatePasswordResetEmail(email);
  if (fieldError) {
    renderForm(email, { fieldError });
    app.querySelector('#email')?.focus();
    return;
  }

  const button = form.querySelector('[type="submit"]');
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    await requestEmailChange(email);
    renderForm(email, {
      message: 'If Supabase accepts the change, check both email inboxes for confirmation links. Follow both links to finish.'
    });
  } catch (error) {
    renderForm(email, { error: error.message || 'We could not request an email change. Please try again.' });
  }
}

app.setAttribute('aria-busy', 'true');
if (isAuthCallbackRequest()) {
  try {
    const session = await waitForAuthCallback(['SIGNED_IN', 'USER_UPDATED']);
    if (session) renderConfirmed();
    else renderUnavailable();
  } catch {
    renderUnavailable();
  }
} else {
  try {
    const session = await initialiseAuth();
    if (!session) renderSignedOut();
    else renderForm(session.user?.email || '');
  } catch {
    renderSignedOut();
  }
}
