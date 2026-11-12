import { waitForAuthCallback } from '../core/auth.js';
import { escapeHtml } from '../core/html.mjs';

const app = document.querySelector('#auth-flow-app');

function renderSuccess() {
  app.innerHTML = `
    <p class="tag">Email confirmation</p>
    <h1>Email confirmed.</h1>
    <p data-auth-status class="form-message" role="status">Your email is confirmed. Log in to sync your learning progress.</p>
    <a class="button button-primary" href="login.html">Continue to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
}

function renderError(message = 'This confirmation link is invalid or has expired. Request a new confirmation email and try again.') {
  app.innerHTML = `
    <p class="tag">Email confirmation</p>
    <h1>We could not confirm your email.</h1>
    <p class="form-error" role="alert" tabindex="-1">${escapeHtml(message)}</p>
    <a class="button button-primary" href="login.html">Go to login</a>
  `;
  app.setAttribute('aria-busy', 'false');
  app.querySelector('[role="alert"]')?.focus();
}

app.setAttribute('aria-busy', 'true');
try {
  const session = await waitForAuthCallback();
  if (session?.user?.email_confirmed_at) renderSuccess();
  else renderError();
} catch {
  renderError();
}
