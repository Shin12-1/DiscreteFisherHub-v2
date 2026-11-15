# Supabase and deployment setup

## Supabase

1. In the Supabase dashboard, open **SQL Editor**, create a query, paste `supabase/schema.sql`, and run it once on an empty project. This schema is not an idempotent migration; do not rerun it on a database where the tables or triggers already exist.
2. Confirm `profiles`, learner-event tables, achievement/notification tables, and projection tables appear in **Table Editor** with RLS enabled, and that the `leaderboard` and `profile_public_projection` views exist.
3. Under **Authentication → Sign In / Providers**, enable **Email**, require email confirmation, and enable **Google**. Create a Google OAuth client in Google Cloud, add `http://localhost:5173` and `https://discretefisherhub-v2.vercel.app` as authorized JavaScript origins, and add the callback URI shown in the Supabase Google provider settings as an authorized redirect URI. Store the Google client ID and secret only in the Supabase provider settings; never put the secret in this repository.
4. Under **Authentication → URL Configuration**, set the Site URL to `https://discretefisherhub-v2.vercel.app`. Add these allowed redirect URLs:
   - `https://discretefisherhub-v2.vercel.app/**`
   - `http://localhost:5173/**` for local testing
   The app sends Google sign-in back to `/pages/dashboard.html`, signup confirmation to `/pages/confirm-email.html`, password recovery to `/pages/reset-password.html`, magic-link sign-in to `/pages/magic-link.html`, and email change to `/pages/change-email.html`. The Google callback URI above is Google's return target; the app redirect URLs here are separate. Add your Vercel preview/custom domains to the allow list if you test those too.
5. In **Project Settings → API Keys**, use only the **publishable** key in the browser app. `js/config.js` is committed and contains this project's URL and publishable key (publishable keys are designed to be public; row-level security protects the data). Never put a secret/service-role key in it.
6. For reliable delivery to real users, configure a custom SMTP sender under **Authentication → SMTP Settings** and verify its sender domain. Supabase's default email sender is intended for testing and has sending limits.
7. Keep `{{ .ConfirmationURL }}` in action email templates so Supabase verifies the link before returning to the app. For invitations created by a trusted server/admin workflow, set its redirect to `/pages/invitation.html` and allow that URL above. Do not send invitations from browser code or expose a service-role/secret key.
8. Reauthentication sends a code to the signed-in user's email and is entered at `/pages/reauthenticate.html`. Enable the **Reauthentication** template in **Authentication → Email Templates**. The account security pages only report confirmation for a valid callback; the seven security-change templates remain notification emails.

## Vercel and GitHub

1. Import `Shin12-1/DiscreteFisherHub` into Vercel and set the production branch to `main`. This is a static site: leave the framework preset as **Other**, use no build command, and leave the output directory at the repository root.
2. Connect the GitHub repository to the Vercel project. Each push to `main` then triggers a production deployment; other branches create previews.
3. From PowerShell in the repository root, review and push the intended changes:

   ```powershell
   git status
   git add -A
   git commit -m "Describe your change here"
   git push origin main
   ```

The database stores the auth email in Supabase plus nickname and learning progress. The leaderboard view deliberately contains only `nickname` and `xp`. No Supabase secret key or Vercel server function is needed for this browser-only app.

## Verification

1. Create a test account with an inbox you can access. The confirmation link should return to the app; after confirmation, log in to sync progress.
2. Use **Resend confirmation email** if the first email does not arrive. Check spam and confirm SMTP settings if delivery still fails.
3. Create two test accounts in separate browser profiles. Each should see and update only its own profile/progress. Attempting to update `xp`, `level`, `streak`, or `last_active` from the browser client must fail because the authenticated role is granted update access only to `profiles.nickname`.

## Optional migrations

`supabase/schema.sql` is the complete fresh-install schema. It is not idempotent: run it once on an empty project and do not apply the optional migrations afterward.

For an existing database, apply the profile migrations once, in timestamp order:

1. `migrations/20261115060224_profile_achievements_phase1.sql` adds the privacy settings, stable profile handles, study records, achievement catalog/awards, notifications, blocks/reports, and privacy-filtered reads.
2. `migrations/20261115071800_profile_visibility_actions.sql` adds badge pinning, the profile action functions, and the report-reason constraint update.

Existing and new profiles default to private, all six profile sections default to private, and search discovery and leaderboard participation default to off. Learners must opt in explicitly. The migrations are files only; this repository change does not apply them to the hosted project.

Run `npm run check` for the local frontend checks. With Docker and a local Supabase stack available, run `npx supabase test db supabase/tests/profile_achievements_phase1.sql` for the pgTAP database checks. Do not use `--remote` for these tests.

For a manual two-account privacy check, keep one profile private, set one to **public**, and set one to **members**. Verify signed-out visitors can open only the public profile and a signed-in Hub learner can open the members-only profile. Hide a section and confirm it is absent to viewers; make a profile private again and confirm its shared URL is unavailable and owner sharing is disabled. Scan a QR to confirm it contains only the stable profile URL, and check that the downloadable card contains only the nickname, selected title, and pinned badges. Verify block/report actions work only while signed in. No profile should appear on the leaderboard until its owner opts in; the row exposes only nickname and XP.

Nickname search, follows, badge feeds, friend comparisons, class codes, shared challenges, section leaderboards, and weekly spotlights are later-phase work.
