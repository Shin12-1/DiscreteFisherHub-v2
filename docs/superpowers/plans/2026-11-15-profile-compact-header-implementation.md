# Profile Compact Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Profile's space-consuming summary column with a compact identity header above the preferences form.

**Architecture:** Keep `profileView(user, state)` and existing form handlers. Put the identity summary before the existing settings form in a single-column Profile layout, remove duplicate program/year summary rows, and adjust scoped CSS only.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-15-profile-compact-header-design.md`

## Global Constraints

- Keep all existing preference fields, account actions, labels, and save/error feedback.
- Preserve guest and signed-in status, profile persistence, nickname validation, appearance, and reduced-motion behavior.
- Do not change authentication, data storage, account-security flows, or other pages.
- Do not add dependencies or new settings.
- The identity strip and form should stack naturally on narrow screens, without horizontal overflow or loss of visible keyboard focus.
- Leave all changes uncommitted.

## Review Focus

- A 32-character nickname must wrap inside the compact identity header; check the 32-character Profile rendering in the browser.
- A long signed-in email must wrap without widening the header; check a long email in the signed-in browser view.
- At 375px, the header, settings form, and account actions must fit without horizontal overflow; check the document width in the browser.
- Light and dark themes must preserve readable text and controls; use the existing Profile appearance test and inspect both themes in the browser.
- Guest and signed-in account actions must remain distinct; retain the existing guest/signed-in security-link smoke test.

---

### Task 1: Replace the summary column with a compact identity header

**Files:**
- Modify: `js/pages/student-views.js` (`profileView`)
- Modify: `js/pages/app.js` (remove summary-only save DOM updates)
- Modify: `css/pages.css` (Profile layout styles)
- Test: `scripts/test-app-smoke.mjs`
- Test: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes: `profileView(user, state)`, current learner/profile preferences, and the existing profile/account handlers.
- Produces: `.profile-layout` with `.profile-summary` followed by `[data-profile-form]`; the summary contains avatar, nickname, and guest/account status but no program/year rows. Program and year remain in the form.

- [x] **Step 1: Write the failing layout assertion**

Update the test currently named `profile: card-and-settings layout keeps identity with preferences` to `profile: compact identity header precedes preferences`. Assert that:
  - `.profile-summary` is the first child of `.profile-layout` and the preferences form is the second.
  - The summary contains the avatar and status but no `.profile-summary-details`.
  - `#profile-program` and `#profile-year-level` remain in the form.
  - `.profile-account` remains after `.profile-layout`.
Update the renderer assertions in `scripts/test-learning-experience.mjs` to assert that the summary-detail rows are absent while the program and year fields remain present. Update the profile save smoke assertions to read program/year values from the form instead of the removed summary.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `$env:ONLY='profile: compact identity header'; node scripts/test-app-smoke.mjs`

Then run: `node scripts/test-learning-experience.mjs`

Expected: Both fail because the existing renderer still contains duplicate program/year summary rows.

- [x] **Step 3: Implement the compact header**

In `profileView`, remove the summary's program/year `<dl>` and keep its avatar, nickname, and guest/account status. In `css/pages.css`, make `.profile-layout` a single-column grid with a compact summary card above the form; retain the existing form and account styles and responsive behavior. In the Profile save handler in `js/pages/app.js`, remove only the DOM updates for the deleted program/year summary elements; continue updating the nickname and avatar.

- [x] **Step 4: Run focused Profile tests**

Run: `$env:ONLY='profile: compact identity header'; node scripts/test-app-smoke.mjs`

Then run: `node scripts/test-learning-experience.mjs`

Expected: PASS for the new hierarchy and existing Profile behavior.

- [x] **Step 5: Run lint and the full project suite**

Run: `npm run check`

Expected: ESLint and all project tests pass.

- [x] **Step 6: Verify the page in the browser**

At desktop, tablet, and 375px widths, confirm the header precedes the full-width form, Account and privacy follows, the page has no horizontal overflow, long identity text wraps, and light/dark themes remain readable.
