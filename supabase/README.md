# Supabase setup

1. In the Supabase dashboard, open **SQL Editor** for the target project.
2. Create a new query, paste the complete contents of `supabase/schema.sql`, and select **Run** on an empty project.
3. Confirm `profiles`, `lesson_progress`, and `quiz_attempts` appear in **Table Editor** with RLS enabled. The `leaderboard` view should also appear.
4. In **Authentication → Providers**, enable Email. Configure email confirmation and the Site URL/redirect URLs for the Vercel domain you will use.
5. Copy the project's **anon/publishable** key (never a privileged or secret key). Copy `js/config.example.js` to `js/config.js`, then replace only `PASTE_YOUR_SUPABASE_ANON_KEY_HERE`.

The database stores only the auth email managed by Supabase, nickname, and learning progress. The leaderboard view deliberately contains only `nickname` and `xp`.

## Verification after setup

Create two test accounts in separate browser profiles. Each should see and update only its own profile/progress. Attempting to update `xp`, `level`, `streak`, or `last_active` from the browser client must fail because the authenticated role is granted update access only to `profiles.nickname`.

