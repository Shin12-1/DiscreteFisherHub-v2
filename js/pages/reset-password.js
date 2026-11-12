import { updatePassword, waitForPasswordRecovery } from '../core/auth.js';
import { validateNewPasswordFields } from '../core/auth-validation.mjs';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');
let recoveryReady = false;

function renderExpired(message = 'This password-reset link is invalid or has expired. Request a new one to continue.') {
  recoveryReady = false;
  app.innerHTML = `
    <p class="tag">Account recovery</p>
    <h1>Reset link unavailable.</h1>
    <p class="form-error" role="alert" tabindex="-1">${escapeHtml(message)}</p>
    <a class="button button-primary" data-restart-reset href="forgot-password.html">Request another reset link</a>
    <a class="text-button" href="login.html">Back to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
  app.querySelector('[role="alert"]')?.focus();
}

function renderForm(error = '', fieldErrors = {}) {
  app.innerHTML = `
    <p class="tag">Account recovery</p>
    <h1>Choose a new password.</h1>
    <p>Use at least 8 characters, then enter the same password again.</p>
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <form id="reset-password-form" novalidate>
      <div class="field">
        <label for="password">New password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" aria-describedby="password-help${fieldErrors.password ? ' password-error' : ''}" ${fieldErrors.password ? 'aria-invalid="true"' : ''} required>
        <small id="password-help">At least 8 characters.</small>
        ${fieldErrors.password ? `<small id="password-error" class="field-error">${escapeHtml(fieldErrors.password)}</small>` : ''}
      </div>
      <div class="field">
        <label for="confirm-password">Confirm new password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" aria-describedby="${fieldErrors.confirmPassword ? 'confirm-password-error' : ''}" ${fieldErrors.confirmPassword ? 'aria-invalid="true"' : ''} required>
        ${fieldErrors.confirmPassword ? `<small id="confirm-password-error" class="field-error">${escapeHtml(fieldErrors.confirmPassword)}</small>` : ''}
      </div>
      <button class="button button-primary" type="submit">Save new password</button>
    </form>
    <a class="text-button" href="login.html">Back to login</a>
  `;
  app.querySelector('#reset-password-form').addEventListener('submit', submit);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

function renderSuccess() {
  recoveryReady = false;
  app.innerHTML = `
    <p class="tag">Account recovery</p>
    <h1>Password updated.</h1>
    <p data-auth-status class="form-message" role="status">Your password has been updated. Sign in with your new password.</p>
    <a class="button button-primary" href="login.html">Return to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

async function submit(event) {
  event.preventDefault();
  if (!recoveryReady) return;
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
    renderForm(error.message || 'We could not update your password. Please try again.');
  }
}

app.setAttribute('aria-busy', 'true');
try {
  const session = await waitForPasswordRecovery();
  if (!session) renderExpired();
  else {
    recoveryReady = true;
    renderForm();
  }
} catch (error) {
  renderExpired(error.message || 'We could not verify this password-reset link. Request a new one and try again.');
}
