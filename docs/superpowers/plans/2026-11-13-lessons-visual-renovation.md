# Lessons Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user-selected focused-reader layout to Lessons while preserving every existing lesson interaction.

**Architecture:** Reshape the existing `lessonsView(lessons, state, lessonId)` template and its page-specific CSS. Keep the shared shell, route, lesson data, state handling, widgets, and action handlers unchanged.

**Tech Stack:** HTML templates, CSS, vanilla JavaScript ES modules, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.
- Lessons mockup direction: **A · Focused lesson reader**; use a wide reading column with progress and section navigation near the lesson content.

## Review Focus

- A different lesson ID must keep its own selected state, content, and navigation; cover the current lesson and all three pathway links in the focused-reader smoke test.
- Completed lessons must retain their completion state and not award XP twice; retain and run the existing completion smoke test.
- Truth-table and self-check interactions must remain usable in the reading flow; run the existing widget test and exercise the self-check reveal in the focused-reader smoke test.
- Long lesson titles and section labels must wrap without horizontal overflow at 375px; verify in the browser at 375px.
- Light and dark themes must retain readable text and visible keyboard focus; verify both themes and keyboard focus in the browser.

---

### Task 1: Implement the focused Lessons reader

**Files:**
- Modify: `js/pages/learning-views.js` (`lessonsView`)
- Modify: `css/pages.css` (Lessons layout and pathway styles)
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `lessonsView(lessons, state, lessonId)`, existing lesson data, `lessonLink`, `getTopicProgress`, `progressBar`, and existing completion/reveal/widget handlers.
- Produces: A single-column reading layout with course progress, all lesson pathway links, section anchors, the existing lesson body and self-checks, resources, completion action, and previous/next navigation.

- [x] **Step 1: Add a focused-reader smoke test**

Add a test named `lesson: focused reader keeps pathway and section outline in the reading flow`. Open `logic-truth-tables` and assert that the focused-reader layout is present, all three Logic lesson links remain in the pathway with the selected lesson marked current, the section outline links into the lesson body, and the completion action remains available. Click the self-check reveal and assert its explanation becomes visible.

- [x] **Step 2: Run the targeted test and verify it fails**

Run: `$env:ONLY='lesson: focused reader'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the current lesson layout is a two-column reader with a separate course rail.

- [x] **Step 3: Reshape `lessonsView` into the selected reading flow**

Keep the lesson heading and live progress at the top. Place the full Logic lesson pathway and current lesson section outline before the lesson sections in the main reading column. Retain the interactive sections, resource link, self-check reveal, completion action, and previous/next lesson or quiz actions; remove only the redundant right-hand lesson rail.

- [x] **Step 4: Add responsive focused-reader styles**

In `css/pages.css`, style the single-column reading area, compact responsive lesson pathway, and in-page outline using existing theme tokens. Ensure the pathway and long labels wrap on narrow screens.

- [x] **Step 5: Run the targeted Lessons smoke tests**

Run: `$env:ONLY='lesson:'; node scripts/test-app-smoke.mjs`

Expected: PASS for the focused layout and existing lesson completion, truth-table, and self-check behavior.

- [x] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [x] **Step 7: Verify Lessons in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm the reading column, lesson links, section anchors, completion action, truth-table and self-check behavior, visible keyboard focus, and no horizontal overflow.
