# Authentication Email Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build dedicated, validated site journeys for each actionable authentication email while leaving security-change notices as email-only.

**Architecture:** Keep the existing static HTML and ES-module app. Add one HTML entry per auth action, reuse the existing Supabase client and validation patterns, and send each email action back to its matching page. Extend the existing smoke tests to exercise the forms and callback/error states.

**Tech Stack:** HTML, CSS, browser ES modules, Supabase JS v2, Node.js test scripts, jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-auth-email-flows-design.md`

## Global Constraints

- The site is a static HTML/ES-module app using the existing Supabase browser client and page patterns.
- Email redirects must return to the correct page and be included in the Supabase project's allowed redirect URLs.
- Never put a Supabase secret/service-role key in the browser app.
- Keep current login/signup and guest learning behavior working.
- The seven security-change notices remain email-only.

## Review Focus

- Malformed email on reset/change requests must show an inline validation message and make no Supabase call. (Task 1 and Task 2)
- Short or mismatched new passwords must be rejected before submission. (Task 1 and Task 2)
- Missing/expired reset links must show an error and restart link, never a success state. (Task 2)
- Reset requests must show a neutral inbox message for any accepted address so account existence is not disclosed. (Task 2)
- Invalid/expired OTPs and signed-out attempts to change email or reauthenticate must show an actionable error without claiming success. (Tasks 4 and 5)

---

### Task 1: Adding shared auth validation and Supabase actions

**Files:**
- Modify: `js/core/auth-validation.mjs`
- Modify: `js/core/auth.js`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Produces `validatePasswordResetEmail(email) -> string`, `validateNewPasswordFields({ password, confirmPassword }) -> { password?: string, confirmPassword?: string }`, and `validateOtpField(token) -> string`.
- Produces `requestPasswordReset(email) -> Promise<void>`, `updatePassword(password) -> Promise<void>`, `sendMagicLink(email) -> Promise<void>`, `verifyEmailOtp(email, token) -> Promise<Session | null>`, `requestEmailChange(email) -> Promise<void>`, `requestReauthentication() -> Promise<void>`, and `verifyReauthenticationCode(email, token) -> Promise<void>`.
- Existing login/signup validation and `signUp`, `signIn`, and `resendSignupConfirmation` behavior remain compatible.

- [ ] **Step 1: Add failing validation and auth-wrapper tests**

Add focused smoke tests asserting malformed emails, short passwords, mismatched passwords, and blank codes are rejected; verify reset/magic-link/email-change redirects target their dedicated HTML pages; verify Supabase failures reject rather than appear successful.

- [ ] **Step 2: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: FAIL because the new validators and action methods do not exist yet.

- [ ] **Step 3: Implement the shared validators and auth wrappers**

Use the existing field-error shape and `ensureClient()` / `explainAuthError()` patterns. Use `resetPasswordForEmail(email, { redirectTo })`, `signInWithOtp`, `verifyOtp`, `updateUser`, and `reauthenticate`; derive redirect URLs from the app origin.

- [ ] **Step 4: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: PASS for validation, redirects, and explicit error propagation.

### Task 2: Building the password-recovery journey

**Files:**
- Modify: `js/pages/login.js`
- Create: `pages/forgot-password.html`
- Create: `js/pages/forgot-password.js`
- Create: `pages/reset-password.html`
- Create: `js/pages/reset-password.js`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes Task 1's reset validators and `requestPasswordReset` / `updatePassword`.
- Login links to `pages/forgot-password.html`; the email reset redirect targets `pages/reset-password.html`.

- [ ] **Step 1: Add failing form-flow tests**

Test that the login page exposes “Forgot password?”, invalid email does not send a request, an accepted request shows the same neutral inbox message, password mismatch blocks saving, and a missing/expired recovery session shows an error with a restart link.

- [ ] **Step 2: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: FAIL because the recovery pages and login link are missing.

- [ ] **Step 3: Implement the request and reset pages**

Use the existing login card styles, `role="alert"` for failures, `aria-invalid`/`aria-describedby` for field errors, and a status message after a reset email request. The reset page requires a valid recovery session before allowing a new password and confirmation.

- [ ] **Step 4: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: PASS for invalid input, neutral request status, expired link handling, and successful password update.

### Task 3: Adding signup-confirmation and invitation pages

**Files:**
- Modify: `js/core/auth.js`
- Create: `pages/confirm-email.html`
- Create: `js/pages/confirm-email.js`
- Create: `pages/invitation.html`
- Create: `js/pages/invitation.js`
- Modify: `supabase/README.md`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes `initialiseAuth()` and Task 1's `updatePassword`.
- Signup and resend-confirmation redirects target `pages/confirm-email.html`; invitation links return to `pages/invitation.html`. Invitation sending remains an admin/Supabase operation, not a browser operation.

- [ ] **Step 1: Add failing callback tests**

Test confirmed signup completion, an invalid/expired confirmation link, invitation acceptance with password confirmation, and the missing-session invitation error.

- [ ] **Step 2: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: FAIL because the callback pages and page-specific redirects are missing.

- [ ] **Step 3: Implement the confirmation and invitation pages**

Use the existing session initialization and password validator. Update the Supabase setup guide with the page redirect paths and the required invite redirect configuration; do not add a service-role key or browser-side invite API.

- [ ] **Step 4: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: PASS for valid and invalid callback states.

### Task 4: Adding magic-link and OTP sign-in

**Files:**
- Modify: `js/pages/login.js`
- Create: `pages/magic-link.html`
- Create: `js/pages/magic-link.js`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes Task 1's `sendMagicLink`, `verifyEmailOtp`, and OTP validator.
- Login links to the magic-link page; magic-link callbacks target `pages/magic-link.html`.

- [ ] **Step 1: Add failing magic-link tests**

Test invalid email, successful link request, blank/invalid OTP feedback, and successful OTP sign-in using a mocked Supabase client.

- [ ] **Step 2: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: FAIL because the page and link are missing.

- [ ] **Step 3: Implement the magic-link/OTP page**

Provide email-request and code-entry states with visible status/error messages; handle either the emailed link callback or a manually entered code.

- [ ] **Step 4: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: PASS for request, invalid-code, and successful sign-in states.

### Task 5: Adding email-change and reauthentication journeys

**Files:**
- Modify: `js/pages/student-views.js`
- Create: `pages/change-email.html`
- Create: `js/pages/change-email.js`
- Create: `pages/reauthenticate.html`
- Create: `js/pages/reauthenticate.js`
- Modify: `supabase/README.md`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes Task 1's `requestEmailChange`, `requestReauthentication`, and `verifyReauthenticationCode`.
- The signed-in profile links to the email-change and identity-verification pages; email-change verification returns to `pages/change-email.html`.
- Profile navigation uses ordinary links, so no additional app-level event handler is needed.

- [ ] **Step 1: Add failing email-change and reauthentication tests**

Test malformed email, signed-out access, successful email-change request/confirmation, invalid/expired reauthentication code, and successful reauthentication.

- [ ] **Step 2: Run the targeted smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: FAIL because the pages and profile links are missing.

- [ ] **Step 3: Implement both flows**

Only signed-in users can request an email change or reauthentication code. Show field-level validation, explicit API failures, and success only after Supabase confirms the operation. Document the redirect paths and the manual email-template/dashboard settings that remain outside the static app.

- [ ] **Step 4: Run final verification**

Run: `npm run check`
Expected: lint and all existing/new validation, page-smoke, and learning tests pass.
