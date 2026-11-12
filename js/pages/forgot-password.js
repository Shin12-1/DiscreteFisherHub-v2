import { requestPasswordReset } from '../core/auth.js';
import { validatePasswordResetEmail } from '../core/auth-validation.mjs';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');
let emailValue = '';

function render(message = '', error = '', fieldError = '') {
  app.innerHTML = `
    <p class="tag">Account recovery</p>
    <h1>Reset your password.</h1>
    <p>Enter the email address linked to your study account. We’ll send a secure reset link if an account matches.</p>
    ${error ? `<p class="form-error" role="alert" tabindex="-1">${escapeHtml(error)}</p>` : ''}
    <form id="forgot-password-form" novalidate>
      <div class="field">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" autocomplete="email" value="${escapeHtml(emailValue)}" aria-describedby="email-help${fieldError ? ' email-error' : ''}" ${fieldError ? 'aria-invalid="true"' : ''} required>
        <small id="email-help">Use the email address linked to your study account.</small>
        ${fieldError ? `<small id="email-error" class="field-error">${escapeHtml(fieldError)}</small>` : ''}
      </div>
      ${message ? `<p data-auth-status class="form-message" role="status">${escapeHtml(message)}</p>` : ''}
      <button class="button button-primary" type="submit">Send reset link</button>
    </form>
    <a class="text-button" href="login.html">Back to login</a>
  `;
  app.querySelector('#forgot-password-form').addEventListener('submit', submit);
  app.setAttribute('aria-busy', 'false');
  if (error) app.querySelector('[role="alert"]')?.focus();
}

async function submit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  emailValue = String(fields.email || '').trim();
  const fieldError = validatePasswordResetEmail(emailValue);
  if (fieldError) {
    render('', '', fieldError);
    app.querySelector('#email')?.focus();
    return;
  }

  const button = form.querySelector('[type="submit"]');
  app.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = 'Sending…';

  try {
    await requestPasswordReset(emailValue);
    render('If an account exists for that address, a password-reset link will arrive shortly. Check your inbox and spam folder.');
  } catch (error) {
    render('', error.message || 'We could not send a reset link. Please try again.');
  }
}

render();
