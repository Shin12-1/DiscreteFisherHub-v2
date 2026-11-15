# Profile Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the expanded Profile experience using the profile composition in the older mockup, while leaving every other production page visually unchanged.

**Architecture:** Add a normalized profile-preferences model stored under its own local-storage key so guest and signed-in preferences never enter Supabase. Extend the existing Profile renderer and save handler while preserving nickname validation and account actions; use existing FVC design tokens and persist appearance/reduced-motion choices locally.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-profile-details-design.md`

## Global Constraints

- Only Profile changes; all other pages retain the existing FVC navy/yellow design.
- New profile preferences are local-only; never send them to Supabase.
- Program and year-level begin unset; do not infer personal details.
- Email remains account-controlled and read-only; preserve existing account actions.
- Reminder choices are preferences only; do not imply that alerts are sent.
- Retain `learning-hub-renovation.html`; remove only the rejected v2 and field-notes previews.

## Review Focus

- A signed-in profile must save preferences locally without changing the Supabase profile payload.
- A guest with an older state and no preferences must receive safe defaults.
- Invalid or partial stored preferences must normalize to valid options without throwing.
- An invalid nickname must block the whole profile save and preserve existing inline validation.
- Unset program/year and account/email actions must remain truthful and usable.

---

### Task 1: Define profile preference defaults and normalization

**Files:**
- Create: `js/core/profile-preferences.mjs`
- Modify: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Produces `PROFILE_PREFERENCE_DEFAULTS` and `normalizeProfilePreferences(value)`.
- Normalized fields: `program`, `yearLevel`, `weeklyGoal`, `sessionLength`, `preferredTime`, `lessonStyle`, `studyReminders`, `assessmentUpdates`, and `reduceMotion`.
- Default `program` and `yearLevel` are empty; goal `3`; session length `25`; time `flexible`; lesson style `worked-examples`; study reminders, assessment updates, and reduced motion `false`.

- [ ] **Step 1: Write failing tests** named `profile preferences: supplies unset academic defaults` and `profile preferences: normalizes invalid and partial values`. Assert empty program/year defaults, and safe defaults for unsupported enums, numeric values, and non-boolean toggles.
- [ ] **Step 2: Run `node scripts/test-learning-experience.mjs`** and confirm the new imports/assertions fail before the helper exists.
- [ ] **Step 3: Implement `normalizeProfilePreferences(value)`** in `js/core/profile-preferences.mjs`, accepting an arbitrary value and returning a fresh object with only the declared fields and allowed values.
- [ ] **Step 4: Run `node scripts/test-learning-experience.mjs`** and confirm both new tests pass.

### Task 2: Persist preferences separately from synced learner state

**Files:**
- Modify: `js/core/state.js`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- `getState()` returns the existing learner state plus normalized `profilePreferences`.
- `saveState(next)` stores preferences under `dfh:profile-preferences`; learner progress and nickname continue through the existing storage adapter.
- Preferences are read and written through `getLocalStorageAdapter()`, not the active Supabase adapter.

- [ ] **Step 1: Write failing smoke tests** named `profile: guest with legacy state gets local preference defaults` and `profile: signed-in preferences save locally without syncing`. Assert the guest's program/year remain unset with study defaults, and assert signed-in preferences are stored in `dfh:profile-preferences` while the mocked Supabase profile update contains only `nickname`.
- [ ] **Step 2: Run `node scripts/test-app-smoke.mjs`** and confirm the new profile-preferences test fails.
- [ ] **Step 3: Update `getState()` and `saveState(next)`** to read, normalize, and save the separate local preferences key without changing the existing learner-state/Supabase contract.
- [ ] **Step 4: Run `node scripts/test-app-smoke.mjs`** and confirm the new local-only persistence test passes.

### Task 3: Implement the Profile form and existing-app styling

**Files:**
- Modify: `js/pages/student-views.js`
- Modify: `js/pages/app.js`
- Modify: `js/core/theme.js`
- Modify: `css/pages.css`
- Modify: `css/tokens.css`
- Modify: `scripts/test-learning-experience.mjs`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- `profileView(user, state)` renders the learner summary, optional academic details, study preferences, reminder preferences, display settings, and existing account/privacy actions.
- The form keeps `data-profile-form` and `name="nickname"` for the current submit flow.
- Existing theme remains `state.theme`; reduced motion is applied through `document.documentElement.dataset.reduceMotion`.

- [ ] **Step 1: Write failing profile-view tests** asserting labeled controls, unset program/year options, authenticated email/account links, guest sign-in action, and a note that reminder settings do not send alerts.
- [ ] **Step 2: Write a failing save test** asserting a valid submission saves preferences locally, updates the summary name, applies theme/reduced-motion settings, and reports success; assert an invalid nickname saves nothing.
- [ ] **Step 3: Run `node scripts/test-learning-experience.mjs` and `node scripts/test-app-smoke.mjs`** and confirm the new tests fail.
- [ ] **Step 4: Update `profileView` and the `[data-profile-form]` handler** to normalize fields, preserve nickname validation and account actions, save local preferences, and surface success/errors.
- [ ] **Step 5: Apply the compact summary + adjacent form + account/privacy layout** from `learning-hub-renovation.html` using existing production FVC tokens and responsive profile styles.
- [ ] **Step 6: Apply the saved reduced-motion preference on page initialization** and when the form is saved; retain OS `prefers-reduced-motion` support.
- [ ] **Step 7: Run both targeted test scripts** and confirm the profile rendering, persistence, validation, and settings tests pass.

### Task 4: Remove rejected previews and verify the unchanged routes

**Files:**
- Delete: `.superpowers/brainstorm/1508-1794499085/content/learning-hub-renovation-v2.html`
- Delete: `.superpowers/brainstorm/1508-1794499085/content/learning-hub-field-notes.html`
- Retain: `.superpowers/brainstorm/1508-1794499085/content/learning-hub-renovation.html`

- [ ] **Step 1: Remove only the two rejected preview files**; retain the profile reference file named by the user.
- [ ] **Step 2: Run `npm run check`** and confirm lint plus the full test suite pass.
- [ ] **Step 3: Review `git diff --stat` and `git status --short`** to confirm production changes are limited to Profile/state/theme styling and tests, with no dashboard or other page redesign.
