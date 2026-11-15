# Dashboard Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact daily goal, review recommendations, current notices, and recent activity to the dashboard.

**Architecture:** Store bounded study activity and the chosen daily goal in local storage, separated by guest or signed-in user. Record lesson, unique flashcard, and quiz events at their existing interaction points; pass this data and a site-maintained notice list into the existing dashboard renderer.

**Tech Stack:** Browser JavaScript ES modules, local storage adapter, JSON content, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-dashboard-insights-design.md`

## Global Constraints

- Activity does not sync across devices and notices require a site update.
- Keep existing dashboard content, theme, responsiveness, and account behavior intact.
- Start with an empty list rather than inventing official FVC information.
- Limit the recent-activity list to three short entries.
- Count only newly completed lessons and unique flashcards revealed on the current local calendar day.
- Do not commit or push unless explicitly requested.

## Review Focus

- A signed-in user's local activity must never appear in guest or another signed-in user's dashboard.
- Crossing local midnight must reset today's counts without resetting the saved goal or recent history.
- Repeatedly revealing one card or revisiting a completed lesson must not inflate goal progress.
- Expired, future, or malformed notices must not appear as current announcements.
- A failed Supabase quiz-history save must not erase the local review/activity entry for the completed quiz.

---

### Task 1: Local Dashboard Activity

**Files:**
- Create: `js/core/dashboard-activity.mjs`
- Test: `scripts/test-learning-experience.mjs`

**Interfaces:**
- `getDashboardActivity({ localAdapter, userId, now })` returns `{ goal, today: { date, lessonIds, flashcardIds }, recentEvents }`. `goal` is `lesson` or `flashcards`; default is `lesson`. `userId` is a string or `null` (`null` means guest).
- `setDashboardGoal({ localAdapter, userId, goal })` persists one of those two goal values.
- `recordDashboardActivity({ localAdapter, userId, event, now })` records `lesson-completed` (`id`), `flashcard-revealed` (`id`), or `quiz-attempt` (`mode`, `score`, `total`, `missedQuestionIds`) with a timestamp.
- Keep the latest 20 events. Deduplicate lesson/card IDs in today's counters; use `localDateKey(now)` to roll daily counters over while preserving goal and recent history.

- [ ] **Step 1: Add failing activity-store tests**

  In `scripts/test-learning-experience.mjs`, verify default goal and empty values, separate guest/user keys, date rollover preserving goal/history, unique card and lesson counts, and a maximum of 20 recent events.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `node scripts/test-learning-experience.mjs`
  Expected: FAIL because the activity module exports do not exist.

- [ ] **Step 3: Implement the activity store**

  Implement the three exported functions in `js/core/dashboard-activity.mjs` using the supplied local adapter and actor-specific key. Preserve existing activity on goal changes and preserve existing goal/history when a new local day begins.

- [ ] **Step 4: Run the focused test and confirm it passes**

  Run: `node scripts/test-learning-experience.mjs`
  Expected: Learning experience helper tests pass.

### Task 2: Record Study Events

**Files:**
- Modify: `js/pages/app.js`
- Modify: `js/pages/practice-views.js`
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consume the Task 1 `recordDashboardActivity` interface.
- Use `getCurrentUser()?.id || null` and `getLocalStorageAdapter()` for event identity and persistence.
- Add the flashcard question ID as a data attribute on the flashcard panel so the reveal handler can record the exact card.

- [ ] **Step 1: Add failing browser tests**

  In `scripts/test-app-smoke.mjs`, verify that completing a lesson records one event, revealing a flashcard records it once (hiding/revealing again does not duplicate today's count), and completing a quiz records missed question IDs locally even if `recordQuizAttempt` rejects.

- [ ] **Step 2: Run the focused tests and confirm they fail**

  Run: `node scripts/test-app-smoke.mjs`
  Expected: The new activity assertions fail because interactions do not yet record local events.

- [ ] **Step 3: Wire event recording into existing interactions**

  Record a lesson only when `completeLesson` awards it, a flashcard only when its answer changes from hidden to revealed, and a quiz result once the result is scored. Record quiz activity before remote history persistence so network failure cannot remove local review data.

- [ ] **Step 4: Run the focused tests and confirm they pass**

  Run: `node scripts/test-app-smoke.mjs`
  Expected: The new activity assertions and existing smoke tests pass.

### Task 3: Render Dashboard Goals, Review, Notices, and Activity

**Files:**
- Create: `data/dashboard-notices.json` (empty array initially)
- Modify: `js/core/page-data.mjs`
- Modify: `js/pages/app.js`
- Modify: `js/pages/learning-views.js`
- Modify: `css/pages.css`
- Test: `scripts/test-learning-experience.mjs`
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- `loadPageData('dashboard', load)` additionally returns `notices` from `data/dashboard-notices.json` and the Logic question bank needed to render missed-question prompts.
- Extend `dashboardView` with one dashboard-data object containing `{ activity, notices, questions }`.
- Notice entries have `id`, `source` (`FVC` or `Instructor`), `title`, `body`, and optional date-only ISO `publishedAt`, `dueAt`, and `expiresAt`; hide malformed, not-yet-published, and expired entries.

- [ ] **Step 1: Add failing dashboard renderer and smoke tests**

  Verify the daily goal shows the correct progress and persists changes; the review card shows lesson names and missed prompts; no-attempt/perfect-result empty states are calm; malformed, future, and expired notices are hidden while current notices show source/deadline; and recent activity shows at most three entries beneath the study-tool links.

- [ ] **Step 2: Run focused tests and confirm they fail**

  Run: `node scripts/test-learning-experience.mjs`
  Expected: The new dashboard assertions fail because the renderer and notice loading are not implemented.

- [ ] **Step 3: Implement notice loading and dashboard rendering**

  Add `[]` as the initial notice file. Load it and the question bank only for the dashboard. Render a selectable one-lesson/ten-card goal beside the streak, review data from the three latest local quiz events, current notices or an empty state, and three recent activities. Keep existing quiz history, course progress, and account sections unchanged.

- [ ] **Step 4: Add responsive dashboard styling**

  Update `css/pages.css` so the goal sits beside the streak on wide screens and cards stack at the existing mobile breakpoint. Preserve readable spacing and visible focus states.

- [ ] **Step 5: Run focused tests and confirm they pass**

  Run: `node scripts/test-learning-experience.mjs`
  Expected: Learning experience helper tests pass.

- [ ] **Step 6: Run the smoke suite and verify mobile layout**

  Run: `node scripts/test-app-smoke.mjs`
  Expected: All smoke tests pass; verify the dashboard has no horizontal overflow at 375px and that goal/review/notices/activity remain readable.
