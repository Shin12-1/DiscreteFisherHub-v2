# Quizzes Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user-selected Quiz catalogue layout while preserving current quiz, history, and review behavior.

**Architecture:** Keep `quizLobby` and the existing app handlers, but group the quiz lobby in a catalogue-specific layout. Present the three lesson quizzes first, the mixed review afterward, then recent attempts and unavailable topics.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.
- The user selected **A · Quiz catalogue**: show the three available lesson-specific Logic quizzes first, then mixed review, recent attempts, and topics marked not available yet.

## Review Focus

- Quiz actions remain in the same order as the available Logic lessons; the focused smoke test checks the three quiz IDs before `mixed-review`.
- A guest with no attempts sees the honest empty state rather than a made-up score; the focused smoke test checks that state.
- Latest-attempt display and saved attempt history stay intact; existing quiz-history tests cover real attempts, and the focused test ensures the history section remains after the catalogue.
- The eight unavailable topics remain non-actionable and accurately labeled; the focused smoke test checks their count and absence of quiz actions.
- Long lesson titles remain wrapped and the page remains operable in both themes at 1440px, 768px, and 375px; verify wrapping, action sizing, focus, and no horizontal overflow in the browser.

---

### Task 1: Implement the Quiz catalogue layout

**Files:**
- Modify: `js/pages/app.js` (`quizLobby`)
- Modify: `css/pages.css` (Quiz lobby styles)
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `quizLobby(topics, bank, attempts, historyError)`, the existing Logic question bank, and current `data-start-quiz` handlers.
- Produces: A `.quiz-catalogue` wrapper with three lesson quiz cards before the mixed-review card, followed by the existing attempts history and unavailable-topic sections.

- [ ] **Step 1: Add a focused catalogue smoke test**

Add a test named `quizzes: catalogue leads with lesson quizzes and keeps history below`. Assert `.quiz-catalogue` exists, the three lesson quiz actions appear in bank order before `mixed-review`, each lesson card shows its available five-question count, the guest attempt history shows its empty state, and eight unavailable topic cards remain without quiz actions.

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `$env:ONLY='quizzes: catalogue leads'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the current quiz lobby does not have a `.quiz-catalogue` wrapper.

- [ ] **Step 3: Add the catalogue wrapper and separate hierarchy**

Update `quizLobby` in `js/pages/app.js` to wrap the existing intro, available quizzes, mixed review, recent attempts, and unavailable topics in `.quiz-catalogue`. Keep all `data-start-quiz` actions, attempt history content/error states, and unavailable-topic labels intact; show mixed review after the three lesson quiz cards.

- [ ] **Step 4: Add responsive catalogue styling**

In `css/pages.css`, style the lesson quizzes as the primary catalogue grid and mixed review as a secondary section below. Keep history and unavailable topics after quiz actions, use existing theme tokens, allow long titles to wrap, and keep interactive buttons at least 44px tall.

- [ ] **Step 5: Run the targeted Quiz smoke tests**

Run: `$env:ONLY='quizzes:'; node scripts/test-app-smoke.mjs`

Expected: PASS for the layout test and the existing quiz start, saved-history, and failed-save tests.

- [ ] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [ ] **Step 7: Verify Quizzes in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm lesson quizzes lead, mixed review remains available, recent attempts and unavailable topics follow, long titles wrap, all four quiz actions start, keyboard focus is visible, buttons remain comfortably sized, and there is no horizontal overflow.
