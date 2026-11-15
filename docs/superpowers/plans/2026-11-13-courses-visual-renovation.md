# Courses Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Courses as the user-selected catalogue-first page while preserving live course progress and lesson navigation.

**Architecture:** Extend the existing `coursesView(topics, lessons, state)` template and scoped learning-page styles. Keep the shared shell, routing, course data, lesson links, and progress calculations unchanged.

**Tech Stack:** HTML templates, CSS, vanilla JavaScript ES modules, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.
- Courses mockup direction: **A · Course catalogue**; catalogue heading and counts, published Logic course first, unavailable topics below.
- Use live `topics`, `lessons`, and `state`; mockup sample values are illustrative only.

## Review Focus

- Published Logic lesson count and IDs can differ from an assumed fixed list; render only the lessons supplied for the topic.
- A learner's completed lessons must update the Logic progress display without changing the existing start/continue behavior.
- Topics with no published lessons must remain non-actionable and be accurately marked as in preparation.
- Course names and descriptions may be long; cards must wrap without horizontal overflow at 375px.
- Light and dark themes must preserve readable text, links, and focus indicators.

---

### Task 1: Implement the catalogue-first Courses page

**Files:**
- Modify: `js/pages/learning-views.js` (`coursesView`)
- Modify: `css/pages.css` (course catalogue rules)
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `coursesView(topics, lessons, state)` and existing `getTopicProgress`, `lessonLink`, `getNextLesson`, `pageUrl`, and `escape` helpers.
- Produces: An available-course section followed by an upcoming-topics section; retains each available lesson link, live course progress, and the existing start/continue or review action.

- [x] **Step 1: Add focused failing Courses smoke tests**

Add a guest test asserting that the page shows its catalogue heading and accurate available/preparation counts, renders Logic before the upcoming topics, includes all published Logic lesson links, and renders eight non-actionable upcoming topics.

Add a progress-state test seeded with `logic-propositions` completed. Assert the Logic progress indicator reflects one of three lessons and the existing continuation link points to `logic-truth-tables`.

- [x] **Step 2: Run the targeted tests and verify they fail**

Run: `$env:ONLY='courses:'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the catalogue hierarchy and status sections are not present in the current Courses renderer.

- [x] **Step 3: Restructure `coursesView` for the catalogue-first hierarchy**

In `js/pages/learning-views.js`, keep the published-course card driven by the existing topic and lesson arrays. Place it in the available section with its current progress bar, lesson rows, and start/continue/review actions. Render topics without published lessons in a separate upcoming section as informational cards with no links or buttons. Derive section counts from the provided topic and lesson data rather than hard-coding the mockup's sample values.

- [x] **Step 4: Add scoped responsive catalogue styles**

In `css/pages.css`, style the available Logic course as the primary catalogue card and the upcoming topics as secondary informational cards. Keep styles scoped to the Courses page classes under `.app-shell`; ensure long text wraps and the grid stacks on narrow screens.

- [x] **Step 5: Run the targeted Courses smoke tests**

Run: `$env:ONLY='courses:'; node scripts/test-app-smoke.mjs`

Expected: PASS for catalogue ordering, accurate statuses, live progress, existing lesson links, and start/continue behavior.

- [x] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all existing test scripts pass.

- [x] **Step 7: Verify Courses in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm Logic appears before upcoming topics, lesson actions remain usable, all unavailable topics are non-actionable, text wraps, focus is visible, and there is no horizontal overflow.
