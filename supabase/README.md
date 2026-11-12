# Supabase and deployment setup

## Supabase

1. In the Supabase dashboard, open **SQL Editor**, create a query, paste `supabase/schema.sql`, and run it once on an empty project. This schema is not an idempotent migration; do not rerun it on a database where the tables or triggers already exist.
2. Confirm `profiles`, `lesson_progress`, and `quiz_attempts` appear in **Table Editor** with RLS enabled, and that the `leaderboard` view exists.
3. Under **Authentication → Sign In / Providers**, enable **Email** and require email confirmation.
4. Under **Authentication → URL Configuration**, set the Site URL to `https://discretefisherhub-v2.vercel.app`. Add these allowed redirect URLs:
   - `https://discretefisherhub-v2.vercel.app/**`
   - `http://localhost:5173/**` for local testing
   The app sends signup confirmation to `/pages/confirm-email.html`, password recovery to `/pages/reset-password.html`, magic-link sign-in to `/pages/magic-link.html`, and email change to `/pages/change-email.html`. Add your Vercel preview/custom domains to the allow list if you test those too.
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

`supabase/migrations/` holds changes you can run later in the SQL Editor on an existing database (unlike `schema.sql`, they are safe to run once each, in order). Read the comment at the top of each file first.
