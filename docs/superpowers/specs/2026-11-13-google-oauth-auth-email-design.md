# Google OAuth and authentication email design

## Intent

Let students use Google sign-in from the login/signup and email magic-link pages, while preserving email/password, email-link/OTP, guest access, and password recovery.

## Goals

- Add a "Continue with Google" action, separated by an "or" divider, to the login/signup card and magic-link page.
- Use Supabase Auth's Google OAuth flow and return to the dashboard. The existing session initialization then activates the Supabase data adapter.
- Keep account/profile and learning-progress data in the existing Supabase tables. The current auth-user trigger creates a profile for OAuth-created users; no schema migration is expected.
- Preserve password recovery: Supabase sends the reset email, and the reset page accepts a new password only after a valid recovery session.
- Document the Google provider callback and app redirect allowlist setup, and retain the existing email/SMTP and email-template guidance.

## Non-goals

- Do not replace or combine Google sign-in with magic-link email sign-in.
- Do not modify Supabase project settings, Google credentials, email templates, SMTP settings, or production data from the app.
- Do not add a Google client secret, Supabase secret/service-role key, or any database migration to browser code.

## Constraints

- Keep the static HTML and ES-module architecture and reuse the configured Supabase browser client.
- The Google provider is reported as configured in Supabase; the app redirect destination must still be allowed by the project's URL Configuration.
- Auth success must continue through the existing session activation and data-adapter path; OAuth must not bypass database row-level security.
- Reset requests keep a neutral response so the page does not reveal whether an email belongs to an account.

## Approaches

1. **Shared OAuth helper, two entry points (chosen).** Add one Google sign-in function to the shared auth module and call it from both pages. This keeps provider configuration, redirect handling, and error propagation consistent.
2. **Page-local OAuth calls.** Put the Supabase OAuth call in each page module. This is initially direct but duplicates redirect and error behavior.
3. **New OAuth callback page.** Add a separate return page. The existing dashboard already initializes Supabase sessions from OAuth callbacks, so an extra page would add routing without needed behavior.

## User decision

The Google button appears on both the login/signup page and the magic-link page. The magic-link form remains email-only.

## Acceptance conditions

- Both requested pages render the Google action when Supabase is configured; invoking it uses the Google provider and a dashboard redirect.
- OAuth errors are displayed explicitly; the regular password, magic-link, guest, and reset flows remain intact.
- A Google-created session follows existing Supabase profile and progress synchronization. No new database schema is required.
- Reset-email requests continue to use Supabase and show a neutral inbox message; an invalid or expired recovery link cannot update a password.
- Supabase setup documentation explains the provider callback, allowed app redirects, and email delivery settings without asking the user to expose credentials.
