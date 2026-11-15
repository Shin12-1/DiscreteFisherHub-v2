# Assessments Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the selected Assessments checkpoint-overview layout without changing checkpoint behavior.

**Architecture:** Keep `assessmentView(bank)` as the landing-page renderer and preserve the existing assessment session handlers. Group the current dynamic checkpoint facts, expectation list, and start action into the selected overview, with responsive styles in the existing page stylesheet.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- The user selected **A · Checkpoint overview**: explain the question count, untimed pace, no-XP/no-grade nature, and post-submission review before one clear start action.
- Derive the available question count from the loaded question bank; the current bank has 15 questions across three published Logic lessons.
- Preserve the current five-question readiness threshold, question selection, scoring, answer-review behavior, and no-XP/no-lesson-progress rules.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.

## Review Focus

- The displayed count follows the available question bank; the renderer test checks a reduced four-question bank displays `4 available questions`.
- Fewer than five questions continue to hide the start action and show the existing readiness message; the renderer test checks this boundary.
- A ready checkpoint remains untimed, hides answer feedback until submission, and does not award XP or lesson progress; the smoke test checks the overview copy and existing completion flow.
- The overview presents one start action and explicitly says this is not a course grade; the smoke test checks the visible action and copy before starting.
- At 1440px, 768px, and 375px in light and dark themes, the layout remains readable without horizontal overflow; verify in the browser.

---

### Task 1: Implement the Assessments checkpoint overview

**Files:**
- Modify: `js/pages/practice-views.js` (`assessmentView`)
- Modify: `css/pages.css` (Assessment overview styles)
- Test: `scripts/test-learning-experience.mjs`
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `assessmentView(bank)`, the loaded Logic question bank, and the existing `[data-start-assessment]` handler.
- Produces: An `.assessment-page` overview that shows current question availability, checkpoint expectations, and the existing readiness-aware start control.

- [ ] **Step 1: Add failing renderer and page-flow assertions**

In `scripts/test-learning-experience.mjs`, assert `assessmentView(bank)` uses `.assessment-page`, shows the current question count, explains that answers are reviewed after submission, and retains the start action. Also call `assessmentView` with a four-question bank and assert the dynamic count is shown, the existing “at least five questions” readiness message appears, and no start action is rendered. In the existing `assessment: checkpoint submits and shows a review` smoke test, assert the overview copy, the “not a course grade” label, and one start action before starting; after selecting each answer, assert no correct/incorrect feedback appears before advancing.

- [ ] **Step 2: Run the renderer test and verify it fails**

Run: `node scripts/test-learning-experience.mjs`

Expected: FAIL because the current renderer has no `.assessment-page` overview.

- [ ] **Step 3: Implement the selected overview in `assessmentView(bank)`**

In `js/pages/practice-views.js`, group the heading, dynamic question-count/untimed/no-XP facts, concise “What to expect” list, and existing readiness-aware button inside `.assessment-page`. Keep the `count >= 5` condition and the current not-ready message unchanged; do not add sample scores, grade claims, or lesson-selection controls.

- [ ] **Step 4: Add responsive styles for the overview**

In `css/pages.css`, style the overview facts and expectation list using existing design tokens and card patterns. Keep the start action prominent, support wrapping and a single-column mobile layout, and preserve visible keyboard focus.

- [ ] **Step 5: Run focused assessment tests**

Run: `node scripts/test-learning-experience.mjs`

Then run: `$env:ONLY='assessment: checkpoint'; node scripts/test-app-smoke.mjs`

Expected: PASS for the reduced-bank readiness boundary and the end-to-end checkpoint submit, review, and restart flow.

- [ ] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [ ] **Step 7: Verify the overview in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm the live question count and expectations are visible, there is one start action, no horizontal overflow, the checkpoint still starts and submits, and keyboard focus remains visible.
