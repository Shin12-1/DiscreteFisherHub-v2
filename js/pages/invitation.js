import { updatePassword, waitForAuthCallback } from '../core/auth.js';
import { validateNewPasswordFields } from '../core/auth-validation.mjs';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');
let invitationReady = false;

function renderUnavailable(message = 'This invitation is invalid or has expired. Ask the person who invited you to send another one.') {
  invitationReady = false;
  app.innerHTML = `
    <p class="tag">Study account invitation</p>
    <h1>Invitation unavailable.</h1>
    <p class="form-error" role="alert" tabindex="-1">${escapeHtml(message)}</p>
    <a class="button button-primary" href="login.html">Go to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
  app.querySelector('[role="alert"]')?.focus();
}

function renderForm(error = '', fieldErrors = {}) {
  app.innerHTML = `
    <p class="tag">Study account invitation</p>
    <h1>Set your account password.</h1>
    <p>Choose a password to finish setting up your DiscreteFisher Hub account.</p>
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <form id="invitation-password-form" novalidate>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" aria-describedby="password-help${fieldErrors.password ? ' password-error' : ''}" ${fieldErrors.password ? 'aria-invalid="true"' : ''} required>
        <small id="password-help">At least 8 characters.</small>
        ${fieldErrors.password ? `<small id="password-error" class="field-error">${escapeHtml(fieldErrors.password)}</small>` : ''}
      </div>
      <div class="field">
        <label for="confirm-password">Confirm password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" aria-describedby="${fieldErrors.confirmPassword ? 'confirm-password-error' : ''}" ${fieldErrors.confirmPassword ? 'aria-invalid="true"' : ''} required>
        ${fieldErrors.confirmPassword ? `<small id="confirm-password-error" class="field-error">${escapeHtml(fieldErrors.confirmPassword)}</small>` : ''}
      </div>
      <button class="button button-primary" type="submit">Accept invitation</button>
    </form>
  `;
  app.querySelector('#invitation-password-form').addEventListener('submit', submit);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

function renderSuccess() {
  invitationReady = false;
  app.innerHTML = `
    <p class="tag">Study account invitation</p>
    <h1>Invitation accepted.</h1>
    <p data-auth-status class="form-message" role="status">Your password is set and your study account is ready.</p>
    <a class="button button-primary" href="dashboard.html">Continue to your study space</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

async function submit(event) {
  event.preventDefault();
  if (!invitationReady) return;
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  const fieldErrors = validateNewPasswordFields(fields);
  if (Object.keys(fieldErrors).length) {
    renderForm('', fieldErrors);
    app.querySelector(fieldErrors.password ? '#password' : '#confirm-password')?.focus();
    return;
  }

  const button = form.querySelector('[type="submit"]');
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    await updatePassword(String(fields.password));
    renderSuccess();
  } catch (error) {
    renderForm(error.message || 'We could not accept this invitation. Please try again.');
  }
}

app.setAttribute('aria-busy', 'true');
try {
  const session = await waitForAuthCallback();
  if (!session) renderUnavailable();
  else {
    invitationReady = true;
    renderForm();
  }
} catch {
  renderUnavailable();
}
