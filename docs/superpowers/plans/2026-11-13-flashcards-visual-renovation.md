# Flashcards Visual Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user-selected single-card focus to Flashcards without changing the existing deck behavior.

**Architecture:** Wrap the existing `flashcardsView(bank, index, revealed)` page content in a focused study surface and add page-scoped CSS. Keep deck data, reveal and navigation handlers, activity tracking, and the empty-deck fallback unchanged.

**Tech Stack:** HTML templates, CSS, vanilla JavaScript ES modules, Node.js smoke tests with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-learning-hub-renovation-design.md`

## Global Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.
- Flashcards mockup direction: **A · Single-card focus**; center the current prompt and choices with progress and reveal/navigation controls close by.

## Review Focus

- Card count and order must remain data-derived; the existing deck test verifies the initial prompt and next card.
- Repeated answer reveal/hide actions must retain their current activity tracking behavior; the existing deck test verifies the answer and logged activity.
- Previous and Next remain disabled at the first and last cards; verify in the focused-layout smoke test and by advancing to the last card in the browser.
- Long prompt and choice text must wrap at 375px; verify in the browser at that viewport.
- Light/dark themes and visible keyboard focus must remain intact; verify both themes and keyboard focus in the browser.

---

### Task 1: Implement the focused Flashcards study surface

**Files:**
- Modify: `js/pages/practice-views.js` (`flashcardsView`)
- Modify: `css/pages.css` (Flashcards styles)
- Test: `scripts/test-app-smoke.mjs`

**Interfaces:**
- Consumes: `flashcardsView(bank, index, revealed)`, the existing flattened Logic question bank, `getQuestions`, and current reveal/navigation event handlers.
- Produces: A centered current-card view with the live deck position, prompt, choices, hidden/revealed answer and explanation, and existing controls.

- [ ] **Step 1: Add a focused-layout smoke test**

Add a test named `flashcards: single-card focus keeps deck controls with the active prompt`. Open the page and assert that the focused study surface contains one current prompt, its four choices, the first-of-fifteen progress status, a disabled Previous control, and the Reveal and Next controls.

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `$env:ONLY='flashcards: single-card focus'; node scripts/test-app-smoke.mjs`

Expected: FAIL because the current page has no focused study surface around the intro and card.

- [ ] **Step 3: Wrap the existing Flashcards page in a focused study surface**

Update the non-empty `flashcardsView` output in `js/pages/practice-views.js` to group its intro and current card. Keep the question, choices, hidden/revealed answer, progress, and existing `data-flashcard-*` controls intact; leave the empty-deck fallback unchanged.

- [ ] **Step 4: Add responsive single-card styles**

In `css/pages.css`, center and space the focused study surface, emphasize the current question and choice rows, and keep the progress and actions adjacent to the card. Ensure long text wraps and actions stack on narrow screens using existing theme tokens.

- [ ] **Step 5: Run the targeted Flashcards smoke tests**

Run: `$env:ONLY='flashcards:'; node scripts/test-app-smoke.mjs`

Expected: PASS for the focused layout and the existing reveal, deck navigation, and activity behavior.

- [ ] **Step 6: Run lint and the full test suite**

Run: `npm run check`

Expected: ESLint and all smoke tests pass.

- [ ] **Step 7: Verify Flashcards in a browser**

Check 1440px, 768px, and 375px in light and dark themes. Confirm the current card and actions stay together, reveal/hide works, Next advances the deck, Previous and Next are disabled at their respective deck ends, focus is visible, and there is no horizontal overflow.
