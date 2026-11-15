# Practice Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user-selected lesson-sets-first Practice layout while preserving the existing practice choices and behavior.

**Architecture:** Extend the existing `practiceView(bank)` markup with a Practice-specific layout wrapper and style its lesson set cards as the primary choices, with mixed review secondary. Keep question selection, attempt flow, explanations, score handling, and no-XP/no-progress behavior unchanged.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates, CSS, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.
- The user selected **A · Lesson sets first**: lead with the lesson-specific Logic practice sets; keep mixed review visible as a secondary option.

## Review Focus

- Each available lesson remains a separate start action, ordered from the live question bank; the focused smoke test checks three lesson actions precede mixed review.
- Per-lesson question counts remain data-derived; the focused smoke test checks the displayed counts against the live bank.
- Mixed review remains available after the lesson sets and retains its current up-to-five-question behavior; the focused smoke test checks its action and existing practice tests cover its run.
- A long lesson title or question count must not overflow the card grid at 375px; verify wrapping in the browser with a long title.
- The page remains readable and operable in dark theme and by keyboard at 1440px, 768px, and 375px; verify theme, focus visibility, and no horizontal overflow in the browser.

---

### Task 1: Implement the lesson-first Practice layout

**Files:**
- Modify: `js/pages/practice-views.js` (`practiceView`)
- Modify: `css/pages.css` (Practice styles)
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `practiceView(bank)` and the existing Logic question bank, plus `data-start-practice` handlers in `js/pages/app.js`.
- Produces: A `.practice-page` wrapper containing the Practice intro and `.practice-grid`; three data-derived lesson practice cards appear before the mixed-review card.

- [ ] **Step 1: Add a focused-layout smoke test**

Add a test named `practice: lesson sets lead and mixed review follows`. Assert `.practice-page` exists, contains three lesson-specific start actions in bank order with question counts matching the bank, and contains the existing mixed-review action after those lesson choices. Assert the explanatory copy still says practice scores do not award XP or change lesson progress.

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `$env:ONLY='practice: lesson sets lead'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the current Practice page does not have a `.practice-page` wrapper.

- [ ] **Step 3: Add the Practice layout wrapper**

Update the non-empty `practiceView(bank)` output in `js/pages/practice-views.js` to wrap its existing intro and options in `.practice-page`. Preserve the existing card order, labels, question counts, buttons, empty-question message, and data attributes.

- [ ] **Step 4: Style lesson sets as the primary choices**

In `css/pages.css`, give the Practice layout a responsive section hierarchy: the three lesson cards form the primary group, while mixed review is visually secondary but remains easy to find. Use existing theme tokens; allow long titles and counts to wrap. Keep buttons at least 44px tall and stack actions/cards on narrow screens.

- [ ] **Step 5: Run the targeted Practice smoke tests**

Run: `$env:ONLY='practice:'; node scripts/test-app-smoke.mjs`

Expected: PASS for the layout test and the existing lesson and mixed-review practice flows.

- [ ] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [ ] **Step 7: Verify Practice in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm lesson sets lead and mixed review remains visible, long titles wrap without horizontal overflow, buttons remain comfortably sized, keyboard focus is visible, and the Practice flow still starts from each action.
