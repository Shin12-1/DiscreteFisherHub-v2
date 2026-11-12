# Authentication email flows

## Intent

Give students a connected, real-site journey from login through the action requested by an authentication email. The supplied folder contains 13 Supabase email templates; six start or continue a user action, while seven report a security change.

## Goals

- Add dedicated HTML entry pages for signup confirmation, invitations, magic-link/OTP sign-in, email change, password recovery, and reauthentication.
- Route each action email back to its matching page and show a clear completion or next step.
- For password recovery, verify through the email link, then ask for a new password and confirmation. Do not ask for the old password in a forgotten-password flow.
- Show useful validation and request errors, including invalid input, mismatched passwords, expired links/codes, and network failures; show success when an action completes.
- Keep current login/signup and guest learning behavior working.
- Keep the seven password/email/phone/sign-in-method/MFA change notices as email-only notifications.

## Non-goals

- Adding new phone, MFA, or social sign-in features, or account-security settings that do not exist in the app.
- Changing Supabase SMTP configuration or editing the security-notification email copy.
- Asking for a current password during password recovery. A future signed-in password-change feature would be a separate flow.

## Constraints

- The site is a static HTML/ES-module app using the existing Supabase browser client and page patterns.
- Email redirects must return to the correct page and be included in the Supabase project's allowed redirect URLs.
- Never put a Supabase secret/service-role key in the browser app.

## Approaches

1. **Dedicated HTML entry page per action (chosen).** Each actionable email has a clear destination, while shared auth and validation helpers keep behavior consistent. This matches the requested separate HTML pages and makes return paths easy to understand.
2. **One URL-driven auth page.** Fewer HTML files, but more callback/state routing in one page and less obvious destinations for email links.

The separate-page approach was chosen. Security notices remain email-only because they report completed changes rather than starting an action.

## Flow details

- Login offers “Forgot password?” → enter email → neutral “check your inbox” status → follow the reset link → set and confirm a new password → return to login.
- Signup confirmation and invitation links return to an account-completion page.
- Magic-link/OTP sign-in and reauthentication return to pages that accept their link/code and clearly report success or failure.
- Email-change verification returns to a page that confirms completion and directs the user back to their profile.
- Each page must handle missing, expired, or invalid tokens without appearing successful, and provide a safe way to restart the flow.

## Builder decisions

Reuse the current auth client and validation conventions; add focused page logic and tests for each new behavior. Keep the supplied email HTML as message templates, with redirects configured by the auth calls and Supabase settings rather than treating notification emails as site pages.
