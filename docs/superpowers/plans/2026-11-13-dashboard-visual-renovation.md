# Dashboard Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Dashboard around the selected compact study-first mockup while preserving its existing learner data and interactions.

**Architecture:** Keep the existing shared shell and vanilla page renderer. Reorder the Dashboard view into the selected primary path, then apply the shared navigation/surface treatment and responsive Dashboard CSS to the routed learning pages.

**Tech Stack:** HTML templates, CSS, vanilla JavaScript ES modules, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.

## Review Focus

- A guest with no progress must still see the first available lesson and a clear continuation action; pin this in the Dashboard structure test.
- A learner who completed every Logic lesson must still see the completion state and quiz/review action; pin this in a completion-state smoke test.
- A previously selected daily goal must remain available and save locally; keep the existing daily-goal smoke test passing.
- Long lesson titles and narrow viewports must not clip primary actions or create horizontal overflow; check at 375px and 768px in the browser.
- Dark theme, keyboard focus, and sidebar note text must remain readable; check both themes and tab navigation in the browser.

---

### Task 1: Reorder Dashboard content for the selected study-first layout

**Files:**
- Modify: `js/pages/learning-views.js`
- Modify: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `dashboardView(topics, lessons, state, attempts, attemptsError, dashboardData)` and the existing `lessonLink` helper.
- Produces: Dashboard wrappers `.dashboard-next-step`, `.dashboard-overview`, `.dashboard-pathway`, `.dashboard-study-tools`, and `.dashboard-supporting`; no function signature changes.

- [x] **Step 1: Add a failing Dashboard structure test**

Add a smoke test named `dashboard: compact study-first layout keeps the primary path before supporting panels`. Assert the guest welcome, first-lesson action, and these wrappers appear in this order: `.dashboard-welcome`, `.dashboard-next-step`, `.dashboard-overview`, `.dashboard-pathway`, `.dashboard-study-tools`, `.dashboard-supporting`. Assert the daily-goal control remains inside `.dashboard-supporting`.

- [x] **Step 2: Run the targeted test and verify it fails**

Run: `$env:ONLY='dashboard: compact study-first layout keeps the primary path before supporting panels'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the selected layout wrappers/order are not present yet.

- [x] **Step 3: Add a failing completed-course test**

Add a smoke test named `dashboard: completed Logic pathway keeps its review action`. Seed `dfh:learner-state` with `completedLessons` containing `logic-propositions`, `logic-truth-tables`, and `logic-predicates`; assert the Dashboard renders `All Logic lessons complete` and a quiz/review link within `.dashboard-next-step`.

- [x] **Step 4: Run the targeted test and verify it fails**

Run: `$env:ONLY='dashboard: completed Logic pathway keeps its review action'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the next-step section has not been wrapped with the new structure.

- [x] **Step 5: Reorder `dashboardView` without changing its data behavior**

In `js/pages/learning-views.js`, render the welcome, next-step card, three learning totals, Logic pathway, and study tools in the selected order. Keep the existing complete-course branch. Move the daily goal, review prompts, notices, recent quiz attempts, and recent activity into `.dashboard-supporting`; keep the full course map available below the primary path. Use existing live `state`, `lessons`, `topics`, and `dashboardData`.

- [x] **Step 6: Run the targeted Dashboard tests**

Run: `$env:ONLY='dashboard:'; node scripts/test-app-smoke.mjs`

Expected: PASS for the new structure/completion tests and existing daily-goal persistence test.

### Task 2: Apply the approved shared visual treatment and responsive layout

**Files:**
- Modify: `css/tokens.css`
- Modify: `css/layout.css`
- Modify: `css/clay.css`
- Modify: `css/pages.css`

**Interfaces:**
- Consumes: The Dashboard wrapper classes produced by Task 1 and existing `data-theme` state.
- Produces: A light navigation rail, pale routed-page canvas, white flat cards, navy/gold actions, and a responsive two-column pathway/tools layout.

- [x] **Step 1: Scope the reference palette to routed learning pages**

In `css/tokens.css`, apply the reference's pale neutral canvas, warm gold accent, and soft border to `body[data-page]`, with explicit dark-theme values for canvas and border. Keep the landing page's existing palette unchanged.

- [x] **Step 2: Restyle the shared learning shell and surfaces**

In `css/layout.css`, change the learning-page sidebar to a light rail with dark text, soft active navigation, and a readable side note; keep all nine links, the existing mobile navigation, and focus states. In `css/clay.css`, scope flatter borders, tighter radii, and simpler buttons to `.app-shell` so the landing page is unaffected.

- [x] **Step 3: Style the Dashboard hierarchy**

In `css/pages.css`, style the next-step card, three-card overview, Logic pathway/tools pair, and supporting panels. At 900px and below, stack the pathway/tools and supporting panels; at 560px and below, stack metrics and actions without horizontal overflow.

- [x] **Step 4: Run the Dashboard smoke tests**

Run: `$env:ONLY='dashboard:'; node scripts/test-app-smoke.mjs`

Expected: PASS for Dashboard rendering, completed/guest states, and daily-goal persistence.

- [x] **Step 5: Run lint and full tests**

Run: `npm run check`

Expected: ESLint and all existing test scripts pass.

- [x] **Step 6: Verify the visual states in a browser**

Check Dashboard at 1440px, 768px, and 375px in light and dark themes. Confirm the selected hierarchy, navigation, daily-goal control, long titles, visible keyboard focus, and no horizontal overflow. Do not change any later page's content composition before its own mockup review.
