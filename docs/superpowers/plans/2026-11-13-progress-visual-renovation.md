# Progress Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the selected course-first Progress layout without changing saved progress or quiz-history behavior.

**Architecture:** Keep `progressView(topics, lessons, state, attempts)` as the page renderer. Separate the published Logic card from the eight unavailable topics, place the Logic path and lesson checklist first, and keep totals and quiz history secondary.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-progress-visual-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.
- Preserve existing lesson links, quiz history, its empty/error states, and no-grade meaning for practice scores.

## Review Focus

- Zero, partial, and complete saved lesson state must produce accurate completion totals; renderer tests cover `0 of 3`, `1 of 3`, and `3 of 3` Logic progress.
- The eight unavailable topics must remain visible as non-actionable `Coming soon` cards after the primary Logic path; the smoke test checks their count and absence of links.
- Empty, failed, and populated quiz history must retain the current empty copy, alert, and saved-attempt rows; renderer tests cover each state.
- Invalid attempt dates and more than ten saved attempts must retain the `Date unavailable` fallback and ten-row cap; the renderer test checks both.
- At 1440px, 768px, and 375px in light and dark themes, the layout must remain readable without horizontal overflow and keep keyboard focus visible; verify in the browser.

---

### Task 1: Implement the Progress course-first layout

**Files:**
- Modify: `js/pages/student-views.js` (`progressView`)
- Modify: `css/pages.css` (Progress layout styles)
- Test: `scripts/test-learning-experience.mjs`
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `progressView(topics, lessons, state, attempts)`, the current topic/lesson data, saved learner state, and quiz attempts.
- Produces: A `.progress-page` with the published Logic course completion and linked lesson checklist before supporting totals/history and the eight coming-soon topics.

- [x] **Step 1: Add failing renderer and page-flow assertions**

Extend the existing Progress renderer checks to assert the `.progress-page` wrapper, Logic completion before its lesson checklist, supporting totals/history after the primary path, and the upcoming topics after the primary path. Assert accurate `0 of 3`, `1 of 3`, and `3 of 3` completion, preserve empty and failed-history states, and verify populated history still falls back for invalid dates and renders no more than ten attempts. Add a smoke test with one completed Logic lesson that checks the progress bar value, all three lesson links, all eight non-actionable coming-soon topics, and the supporting totals/history.

- [x] **Step 2: Run the focused tests and verify they fail**

Run: `node scripts/test-learning-experience.mjs`

Then run: `$env:ONLY='progress: course-first'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the current renderer has no `.progress-page` course-first hierarchy.

- [x] **Step 3: Implement the course-first hierarchy in `progressView(topics, lessons, state, attempts)`**

In `js/pages/student-views.js`, render the published Logic progress card and linked lesson checklist before supporting XP/level/streak totals and quiz history. Render the remaining topics in a separate section after the primary path, preserving their current labels and `Coming soon` status. Keep all values data-driven, retain the current empty/error/history behavior, and add no new actions.

- [x] **Step 4: Add responsive styles for the Progress page**

In `css/pages.css`, style the page wrapper, primary Logic path, supporting totals/history, and upcoming-topic section using existing tokens and card patterns. Keep long titles wrapping, collapse detail columns on small screens, and preserve visible keyboard focus.

- [x] **Step 5: Run focused Progress tests**

Run: `node scripts/test-learning-experience.mjs`

Then run: `$env:ONLY='progress: course-first'; node scripts/test-app-smoke.mjs`

Expected: PASS for zero/partial/complete progress, empty/error/populated quiz history, the ten-attempt limit, lesson links, and eight coming-soon topics.

- [x] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [x] **Step 7: Verify the selected layout in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm Logic progress and lesson links lead, supporting totals/history remain visible, all eight upcoming topics remain secondary and non-actionable, there is no horizontal overflow, and keyboard focus remains visible.
