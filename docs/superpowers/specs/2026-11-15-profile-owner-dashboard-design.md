# Profile Owner Dashboard Design

## Intent

Make the owner dashboard from `pages/profile-owner-mockup.html` the live experience on `profile.html`. Keep `pages/profile-mockup.html` as the visitor-facing design reference for the separate public-profile route. The owner dashboard should use real learner data and retain the existing Personal details editor, preferences, account actions, and privacy controls on the same page.

## Goals

- Show the signed-in learner's identity, title, level, membership date, learning stats, study time, fastest timed activities, pinned achievements, mastery, and recent milestones.
- Keep the dashboard at the top of `profile.html`, followed by the existing profile settings and account/privacy sections.
- Treat `profile.html` as the existing application route and replace its old settings-first layout; do not delete the route or serve the static mockup as the live page.
- Keep the current Personal details fields editable. The dashboard's Edit profile action jumps to that editor.
- Provide working owner actions: edit profile, share profile, preview as a visitor, change pinned badges, and manage visibility.
- Keep guest learning and its current profile settings usable without fabricating profile data.
- Preserve existing privacy controls, settings save behavior, and mobile/responsive conventions.

## Non-goals and anti-goals

- Do not add social follow, class, leaderboard, or spotlight behavior in this renovation.
- Do not introduce new profile data, backend tables, migrations, or dependencies.
- Do not show mockup/sample values as if they were real.
- Do not move settings to a new route or remove existing fields/actions.

## Constraints

- `profile.html` is a static shell whose route is rendered by `js/pages/app.js`.
- The existing settings form and handlers live in `js/pages/student-views.js` and `js/pages/app.js`.
- The data-backed profile already loads through `loadPublicProfile` and `renderPublicProfileView`; its section data is filtered by the profile's privacy settings.
- Owner profile data must be loaded with the authenticated owner's own handle and the normal owner query (`visitorPreview: false`). The visitor-preview flag is for rendering the visitor-visible version and is deliberately more restrictive.
- Sharing remains disabled when profile visibility is private. The profile page must not imply that changing a section's visibility exposes it to the owner; owner access is separate from visitor access.

## Approaches

1. **Reuse the data-backed profile renderer — selected.** Load the signed-in owner's profile through the existing privacy-checked RPC and reuse the public-profile sections. Adapt owner actions to jump to settings on the same page, while retaining the existing share and visitor-preview behavior. This avoids a second implementation of profile data and visibility filtering.
2. **Build a separate dashboard renderer.** Duplicate the mockup layout and map each field independently. This gives more layout freedom but duplicates formatting and privacy-sensitive section logic that would have to stay in sync.
3. **Move settings to a separate route.** Make `profile.html` dashboard-only and add a settings page. This separates concerns but adds navigation and conflicts with the selected dashboard-first, settings-below layout.

## Design

### Signed-in profile

1. Keep the existing Profile page introduction.
2. Render the owner dashboard beneath it using the authenticated profile's current public handle and existing profile data, following the owner mockup layout.
   - The identity header shows nickname, selected title when available, level, member-since date, and avatar initials/frame.
   - The stat row, study-time summary, fastest items, pinned badges, earned-of-total count, strongest topics, and recent milestones appear only when their corresponding profile section data is available.
   - Use existing section empty states; do not insert mockup values.
   - Owner actions: Edit profile jumps to the profile editor; Share profile opens the existing QR/share-card dialog and is unavailable for private profiles; Preview as visitor opens the visitor view; Manage visibility jumps to privacy settings; Change pinned badges opens achievements.
3. Keep the current Personal details (nickname, program, and year level) and study-preference editor below the dashboard. The Edit profile action jumps to the Personal details editor.
4. Keep Account and privacy and the full visibility/blocked-profile controls after the editor.

### Guest profile

- Keep the current guest editor and sign-in-to-sync action.
- Show a concise dashboard empty state explaining that the data-backed profile is available after signing in; do not fabricate study, achievement, or membership data.
- Do not show owner share, preview, or visibility actions for a guest.

### Errors

- If profile settings or dashboard data cannot load, show a clear error in the dashboard area and keep the settings/account sections usable.
- Preserve existing console logging and user-visible error patterns. Do not silently substitute sample or zero values.

## Behavior to preserve

- Nickname validation and account synchronization.
- Local study preference, theme, reminder, and reduced-motion persistence.
- Account security, logout, profile visibility, section visibility, search/leaderboard opt-ins, public URL, block/unblock actions.
- Existing QR sharing behavior and privacy gate.

## Acceptance criteria

- `profile.html` shows real signed-in owner profile data above settings and does not render mockup/sample values.
- Achievement progress shows the earned count against the currently loaded achievement catalog total.
- A private owner can still see their own dashboard through the owner-authorized query, while share remains disabled and visitor preview remains subject to visitor visibility rules.
- Dashboard actions navigate or invoke the existing behavior correctly, including same-page anchors for edit and visibility.
- Guests see no fabricated dashboard values and retain existing local profile settings.
- Profile settings/privacy interactions continue to pass existing coverage; focused tests cover owner loading/actions, guest state, and dashboard-load failures.
- `npm run check` passes, and browser validation confirms dashboard-to-settings hierarchy, responsive layout, and no horizontal overflow.
