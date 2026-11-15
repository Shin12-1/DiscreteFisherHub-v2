# Profile Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the selected Profile card-and-settings layout without changing saved preferences, authentication, or account behavior.

**Architecture:** Keep `profileView(user, state)` and the existing profile form handlers. Add a scoped page wrapper and responsive styles for the selected identity-card-plus-settings composition, then pin the hierarchy with focused renderer and page-flow assertions.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-profile-visual-renovation-design.md`

## Global Constraints

- Continue using the existing `profileView(user, state)` renderer, shared shell, profile form handlers, and CSS tokens/card patterns.
- Do not change nickname validation, preference defaults, persistence, authentication, or account-security flows.
- Nickname and theme continue using learner state; study preferences remain local. Signed-in nickname updates keep their existing account sync behavior.
- Theme and reduced-motion settings continue applying when settings are saved. Reminder preferences remain local and do not send notifications.
- Preserve visible keyboard focus, readable light/dark themes, responsive single-column behavior, and mobile navigation.
- Do not add fields, account actions, backend changes, or dependencies.

## Review Focus

- At 768px the summary and editor must not become cramped side-by-side; browser verification checks the single-column breakpoint and horizontal overflow.
- At 375px all settings and account actions must fit and wrap without horizontal scrolling; browser verification checks document width.
- A maximum-length 32-character nickname must wrap inside the summary without pushing the avatar or card beyond the viewport; browser verification seeds this value.
- Light and dark themes must keep form surfaces, controls, and text readable; browser verification toggles both themes.
- Keyboard focus must remain visible and unobscured on a profile control at mobile and desktop widths; browser verification tabs to a control and checks its focus outline.

---

### Task 1: Implement the Profile card-and-settings layout

**Files:**
- Modify: `js/pages/student-views.js` (`profileView`)
- Modify: `css/pages.css` (Profile layout styles)
- Test: `scripts/test-learning-experience.mjs`
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `profileView(user, state)`, current learner/profile preferences, and the existing form and account actions.
- Produces: A `.profile-page` with the learner summary beside the preferences form on desktop, followed by Account and privacy; the sections stack on smaller screens.

- [x] **Step 1: Add failing renderer and page-flow assertions**

In the existing Profile renderer checks, assert that `.profile-page` contains the intro, `.profile-layout`, and `.profile-account` in that order, with `.profile-summary` before `[data-profile-form]`. Add a smoke test named `profile: card-and-settings layout keeps identity with preferences` that verifies the summary and form share `.profile-layout` and Account and privacy follows it.

- [x] **Step 2: Run the focused tests and verify they fail**

Run: `node scripts/test-learning-experience.mjs`

Then run: `$env:ONLY='profile: card-and-settings'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the renderer has no `.profile-page` wrapper yet.

- [x] **Step 3: Implement the selected page wrapper and responsive styles**

In `profileView(user, state)`, wrap the existing Profile introduction, `.profile-layout`, and `.profile-account` in `.profile-page`; keep the summary before the existing form and do not change its fields, actions, or copy. In `css/pages.css`, constrain `.profile-page` to `min(100%, 1040px)`, limit the intro to 760px, and collapse `.profile-layout` to one column at 900px without changing the Progress breakpoint.

- [x] **Step 4: Run the focused Profile tests**

Run: `node scripts/test-learning-experience.mjs`

Then run: `$env:ONLY='profile: card-and-settings'; node scripts/test-app-smoke.mjs`

Expected: PASS for the wrapper and selected hierarchy; existing Profile assertions still cover guest defaults, signed-in security links, preference persistence, appearance, reduced motion, nickname validation, and save behavior.

- [x] **Step 5: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [x] **Step 6: Verify the selected layout in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm the summary and settings are side-by-side only when space permits, Account and privacy follows the form, a maximum-length nickname wraps, there is no horizontal overflow, and keyboard focus remains visible.
