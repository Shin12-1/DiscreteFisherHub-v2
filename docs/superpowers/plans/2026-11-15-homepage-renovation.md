# Homepage Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovate the live DiscreteFisher Hub homepage in the selected Academic clarity direction without changing its existing learning, account, topic, or theme behavior.

**Architecture:** Keep the existing plain HTML/CSS/JavaScript entry point. Update the home-page template and its stylesheet, while retaining the existing runtime in `home.js` and data-driven topic rendering. Add focused assertions to the current jsdom smoke suite.

**Tech Stack:** HTML, CSS, ES modules, Node.js, jsdom, existing Playwright browser tools for responsive visual verification.

**Spec:** `docs/superpowers/specs/2026-11-15-homepage-renovation-design.md`

## Global Constraints

- “Keep the existing brand and navigation, including the account-sensitive Dashboard/Log in link and the accessible theme toggle.”
- “Keep the topic preview data-driven from `data/topics.json`, including every available topic and its current scope label and summary.”
- “Preserve existing account, local-first study, theme, and topic-loading behavior.”
- “Do not add dependencies, remote fonts, or new image assets.”
- “No unrelated modified files are changed.”

## Review Focus

- A guest with no progress must get the Start learning and Browse topics actions, not a sign-in gate; pin this in `home: guest homepage keeps the main learning actions`.
- A signed-in learner and a guest with saved progress must retain their current continue-learning copy and destination; pin both cases in `home: progress-aware hero keeps account and guest states`.
- Topic previews must include every source topic with its current scope label and summary; pin this in `home: topic previews render the complete topic data`.
- Long topic titles and copy must not create horizontal overflow at 375px; verify this in the mobile Playwright check.
- Light and dark themes must expose the matching accessible toggle label and remain usable after switching; pin both labels in `home: theme toggle label reflects the active theme` and check the interaction in the browser.

---

### Task 1: Renovate the live homepage

**Files:**
- Modify: `js/pages/home-view.mjs`
- Modify: `css/home.css`
- Modify: `scripts/test-app-smoke.mjs`
- Modify: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes: `renderHomePage(user, state, theme)` in `js/pages/home-view.mjs`; `#topic-preview` and `[data-theme-toggle]` hooks consumed by `js/pages/home.js`; topic records loaded from `data/topics.json`.
- Produces: The same `renderHomePage(user, state, theme)` API and the same runtime hooks, with the Academic clarity layout and existing guest/account/progress variants intact.

- [x] **Step 1: Add focused homepage tests**

  Update the shared `index.html` smoke-test heading expectation to match the selected direction. Add the named assertions below to `scripts/test-app-smoke.mjs`:

  - `home: guest homepage keeps the main learning actions`: render a guest with no completed lessons and zero XP; assert the new hero heading, `Start learning` linking to `pages/dashboard.html`, `Browse topics` linking to `#topics`, `Log in` linking to `pages/login.html`, and the theme control.
  - `home: progress-aware hero keeps account and guest states`: render a signed-in user with no lessons and a guest with one completed lesson; assert their respective synced/guest copy, completed-lesson details, and `Continue learning` destination.
  - `home: theme toggle label reflects the active theme`: render both `light` and `dark` and assert the corresponding accessible switch label.
  - `home: topic previews render the complete topic data`: load `index.html`, wait for `#topic-preview` to finish rendering, and assert every topic in `data/topics.json` appears with its scope label and summary.

  In `scripts/test-learning-experience.mjs`, replace the obsolete assertion that searches rendered HTML for `TFVC%20CCS.jpg` with an assertion that the homepage stylesheet references its existing `SCHOOL%20BACKGROUND.jpg` campus image.

- [x] **Step 2: Run the focused smoke suite and confirm the new homepage assertions fail**

  Run: `node scripts/test-app-smoke.mjs`

  Expected: the new copy/layout assertions fail against the current homepage; unrelated existing smoke checks remain unchanged.

- [x] **Step 3: Implement the Academic clarity home template**

  Update `renderHomePage(user, state, theme)` in `js/pages/home-view.mjs`. Use a clear navigation header, value-focused hero with campus image and primary/secondary actions, data-driven topic-map section, concise three-step study section, and college/disclaimer footer. Preserve all runtime hooks, account destinations, theme-control label behavior, study links, and the existing progress-aware hero action.

- [x] **Step 4: Implement responsive Academic clarity styling**

  Update `css/home.css` for the template. Reuse existing tokens and assets; provide clear type hierarchy, restrained cards, consistent spacing, visible focus, and responsive layouts that do not overflow. Respect reduced-motion preferences and both existing theme palettes; add no remote font or new asset dependency.

- [x] **Step 5: Run the focused smoke suite**

  Run: `node scripts/test-app-smoke.mjs`

  Expected: all homepage assertions and existing application smoke tests pass.

- [x] **Step 6: Verify responsive and theme behavior in the browser**

  With the local server running, inspect `http://localhost:5173` at 1440px and 375px widths. Confirm all dynamic topic cards fit, the main actions remain visible and usable, no horizontal overflow occurs, the theme toggle works, and no console errors appear.

- [x] **Step 7: Run the repository checks**

  Run: `npm run check`

  Expected: ESLint and all configured test scripts pass.
