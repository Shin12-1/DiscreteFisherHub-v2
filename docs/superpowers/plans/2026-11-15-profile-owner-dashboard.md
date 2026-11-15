# Profile Owner Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `profile-owner-mockup.html` the live signed-in owner experience on `profile.html`, while keeping Personal details editable and preserving the existing settings and privacy experience below it. `profile-mockup.html` remains the visitor-facing design reference for the separate public-profile route.

**Architecture:** Load the owner's profile through the existing `loadPublicProfile` RPC with `visitorPreview: false`, then render it with the existing public-profile renderer and owner actions adapted for same-page settings links. Preserve the current profile form and handlers; guests get an honest sign-in prompt instead of invented dashboard data.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Supabase RPC, Node.js smoke tests.

**Spec:** `docs/superpowers/specs/2026-11-15-profile-owner-dashboard-design.md`

## Global Constraints

- Keep the dashboard at the top of `profile.html`, followed by the existing profile settings and account/privacy sections.
- Keep `pages/profile.html` as the application route; replace its old settings-first layout rather than deleting the route or serving static mockup content.
- The dashboard's Edit profile action targets the existing Personal details editor.
- Do not add social follow, class, leaderboard, or spotlight behavior in this renovation.
- Do not introduce new profile data, backend tables, migrations, or dependencies.
- Do not show mockup/sample values as if they were real.
- Use the authenticated owner's own handle and normal owner query (`visitorPreview: false`).
- Sharing remains disabled when profile visibility is private.
- Keep guest learning and its current profile settings usable without fabricating profile data.
- Preserve existing privacy controls, settings save behavior, and mobile/responsive conventions.

## Review Focus

- Private signed-in owners must still load their full own dashboard, while visitor preview must continue enforcing visitor visibility rules; test the RPC arguments and private-owner rendering.
- Missing profile handles and profile-load errors must not break settings or account controls; test both unavailable data and rejected loads.
- Guests must not see sample stats or owner-only actions; test the guest empty state and existing editor.
- Same-page Edit and Manage visibility actions must target the correct sections; test anchor targets in rendered profile markup.
- The dashboard plus long nicknames/labels must fit small viewports without horizontal overflow; verify in browser at desktop and mobile widths.

---

### Task 1: Render the owner dashboard above profile settings

**Files:**
- Modify: `js/pages/app.js` (profile route loading and owner action context)
- Modify: `js/core/page-data.mjs` (load profile page datasets used by the dashboard)
- Modify: `js/pages/student-views.js` (`profileView` composition and guest/error states)
- Modify: `js/pages/public-profile-view.mjs` (owner action link targets, badge count, and dashboard layout hooks)
- Modify: `css/pages.css` (owner dashboard spacing and responsive layout)
- Test: `scripts/test-app-smoke.mjs`
- Test: `scripts/test-public-profile.mjs`
- Test: `scripts/test-learning-experience.mjs` (profile page data requirements)
- Test: `scripts/test-profile-share.mjs` (DOM location setup for owner renderer)

**Interfaces:**
- Consumes: `loadProfileSettings({ client })`, `loadPublicProfile({ client, handle, visitorPreview: false })`, `renderPublicProfileView({ profile, isOwner, shareAllowed, topics, lessons, quizzes, achievementTotal })`, the existing profile settings renderer, and the existing `bindPublicProfileActions` handler.
- Produces: `profileView(user, state, visibilitySettings, blockedProfiles, profileSettingsError, blockedProfilesError, dashboard)` where `dashboard` is `{ markup: string | null, error: string | null }`. The owner dashboard markup is at the beginning of `.profile-page`; `#profile-details` and `#profile-visibility` remain available below it; guest and error states do not remove settings.
- Extend `renderPublicProfileView` with optional `ownerActionTargets: { edit: string, visibility: string }` and `headingLevel: 'h1' | 'h2'`. Defaults preserve current public-profile behavior; the embedded dashboard uses `#profile-details`, `#profile-visibility`, and `h2`.

- [x] **Step 1: Add failing signed-in owner route tests**

Add a smoke test asserting that the signed-in profile route loads the current `publicHandle` with `visitor_preview: false`, renders the data-backed identity and sections above the Personal details editor, shows the earned badge count against the loaded catalog total, and supplies anchors for Edit profile (`#profile-details`) and Manage visibility (`#profile-visibility`). Assert that a private profile renders owner data but has a disabled share action.

- [x] **Step 2: Run the targeted test and verify it fails**

Run: `$env:ONLY='profile: owner dashboard'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the profile route currently renders settings without loading owner dashboard data.

- [x] **Step 3: Add failing guest and load-error tests**

Add tests asserting that a guest sees the sign-in dashboard prompt without stat or share controls, and that rejected or unavailable owner-profile data produces a visible dashboard error while the editor and account controls remain present.

- [x] **Step 4: Run those targeted tests and verify they fail**

Run: `$env:ONLY='profile:'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the guest and error dashboard states are not rendered yet.

- [x] **Step 5: Load and compose the dashboard**

On the signed-in `profile` route, after profile settings load, request the owner's profile using `profileSettings.publicHandle` and `visitorPreview: false`. Ensure `loadPageData('profile', ...)` loads topics, lessons, and quizzes. Pass these data, `achievementTotal: achievements.achievements.length`, and `shareAllowed: profileSettings.profileVisibility !== 'private'` to the existing renderer. Keep dashboard errors separate from settings errors and render them visibly without dropping the remaining profile page.

Render the owner identity heading as `h2` inside the existing page intro. Add `id="profile-details"` to the existing Personal details section and pass `ownerActionTargets: { edit: '#profile-details', visibility: '#profile-visibility' }` to the renderer. Preview as visitor uses the existing visitor-preview URL; Change pinned badges links to the achievements page; Share profile is bound to the existing QR/share-card behavior. Keep the existing settings fields and visibility target.

For guests, render a brief sign-in prompt in the dashboard position. Do not query remote profile data or display sample metrics.

- [x] **Step 6: Run the focused profile tests**

Run: `$env:ONLY='profile:'; node scripts/test-app-smoke.mjs`

Then run: `node scripts/test-public-profile.mjs`

Expected: owner data appears above settings, guest/error states preserve settings, private sharing remains disabled, and the existing public profile behavior passes.

- [x] **Step 7: Verify the full check**

Run: `npm run check`

Expected: lint and all smoke tests pass.

- [ ] **Step 8: Verify the page in a browser**

Guest route verified at desktop and mobile widths with no horizontal overflow. Owner route, same-page links, and private-share disabled state are covered by the signed-in route and renderer tests. A live authenticated browser session was not available, so verify the owner UI and enabled-share dialog in the deployed/local signed-in session.

- [ ] **Step 9: Commit the completed task**

```bash
git add docs/superpowers/specs/2026-11-15-profile-owner-dashboard-design.md docs/superpowers/plans/2026-11-15-profile-owner-dashboard.md js/core/page-data.mjs js/pages/app.js js/pages/student-views.js js/pages/public-profile-view.mjs css/pages.css scripts/test-app-smoke.mjs scripts/test-public-profile.mjs scripts/test-learning-experience.mjs scripts/test-profile-share.mjs
git commit -m "feat: add owner profile dashboard"
```
