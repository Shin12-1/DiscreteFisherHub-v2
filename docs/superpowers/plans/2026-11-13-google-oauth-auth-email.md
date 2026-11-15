# Google OAuth Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google sign-in to the login/signup and magic-link pages without disrupting existing Supabase email authentication, password recovery, or learner-data sync.

**Architecture:** Add one `signInWithGoogle()` wrapper in `js/core/auth.js` using Supabase `signInWithOAuth` with `provider: 'google'` and a dashboard redirect. Both page modules use that wrapper and show request errors through their existing render functions. Supabase's existing callback/session and database-adapter paths handle the returned user.

**Tech Stack:** Static HTML, browser ES modules, Supabase JS v2, Node.js/jsdom smoke tests.

**Spec:** `docs/superpowers/specs/2026-11-13-google-oauth-auth-email-design.md`

## Global Constraints

- Keep the static HTML and ES-module architecture and reuse the configured Supabase browser client.
- Do not add a Google client secret, Supabase secret/service-role key, or any database migration to browser code.
- The Google provider is configured in Supabase; the app redirect destination must still be allowed by the project's URL Configuration.
- Preserve email/password, email-link/OTP, guest access, and the neutral password-reset response.
- A password-reset link must continue to require a valid recovery session before allowing a password update.

## Review Focus

- Supabase OAuth errors must be visible instead of leaving a disabled button or silent failure; test the error state on both entry pages.
- OAuth must use Google and return to `/pages/dashboard.html`; assert the exact `signInWithOAuth` arguments.
- The Google button must appear on login/signup and magic-link pages without replacing the email forms; assert both page render paths.
- OAuth must continue through the existing Supabase session and database-adapter initialization; preserve the signed-in dashboard/profile smoke tests.
- Password recovery must remain neutral for unknown emails and reject missing/expired recovery sessions; retain the existing request and reset-page tests.

---

### Task 1: Adding Google OAuth to both auth entry pages

**Files:**
- Modify: `js/core/auth.js`
- Modify: `js/pages/login.js`
- Modify: `js/pages/magic-link.js`
- Modify: `css/pages.css`
- Modify: `supabase/README.md`
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Produces `signInWithGoogle() -> Promise<void>` in `js/core/auth.js`. It calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authPageUrl('dashboard.html') } })` and rejects with the existing auth error explanation when Supabase returns an error.
- Login/signup and magic-link page buttons call the shared helper; Supabase handles the provider redirect.

- [ ] **Step 1: Write failing OAuth flow tests**

In `scripts/test-app-smoke.mjs`, add assertions that the shared helper requests provider `google` with `http://localhost/pages/dashboard.html` as `redirectTo`; both pages render the Google action while retaining their email forms; and a mocked provider error appears as an alert on each page.

- [ ] **Step 2: Run the focused smoke tests**

Run: `node scripts/test-app-smoke.mjs`
Expected: FAIL because the shared helper and Google buttons do not exist yet.

- [ ] **Step 3: Implement the shared helper and page actions**

Add the helper in `js/core/auth.js`. Add an "or" divider and "Continue with Google" button to both page renderers, show it only when Supabase is configured, and route click failures through each page's existing error rendering. Keep the magic-link request and OTP forms available.

- [ ] **Step 4: Document Supabase provider setup**

Update `supabase/README.md` with the Google provider setup: copy the callback URI from Supabase into Google OAuth's authorized redirect URIs, configure the Google client ID/secret only in Supabase, and allow the app's dashboard redirect in Supabase URL Configuration. Preserve the existing email SMTP, template, and password-recovery instructions.

- [ ] **Step 5: Run focused and full verification**

Run: `node scripts/test-app-smoke.mjs` and `npm run check`
Expected: OAuth helper/page tests pass, existing recovery and database-session smoke tests remain green, ESLint passes, and the full suite reports all smoke tests passed.

Do not commit or push as part of this plan. A live Google OAuth round trip requires the user's Google account and is not automated; verify the mocked flow locally and leave provider sign-in for the user to test.
