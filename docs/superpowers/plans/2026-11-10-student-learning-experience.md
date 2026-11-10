# Student Learning Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Logic-first student study site readable, interactive, and useful across all navigation destinations, with accessible loading states and a clearer account flow.

**Architecture:** Extend the existing vanilla JavaScript ES-module app and shared renderer. Add small pure learning/auth helpers and page-specific views while reusing local/Supabase state, static lessons, the quiz bank, and the shared app shell. Keep new practice/assessment work formative and avoid new infrastructure or persistence schemas.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, static JSON, current browser storage and Supabase client, Node built-in assertions.

**Spec:** `docs/superpowers/specs/2026-11-10-student-learning-experience-design.md`

## Global Constraints

- “Implementation stays in vanilla HTML, CSS, and JavaScript ES modules.”
- “Logic lessons are the only authored lesson content; no invented completion states for the other eight topics.”
- “Maintain keyboard access, visible focus, touch-sized actions, reduced motion, and WCAG AA text contrast (4.5:1 for normal text) in light and dark themes.”
- “Keep all new actions operable by keyboard; convey correctness, progress, and errors with text, not color alone.”
- “Do not introduce new tables or expose other learners' records.”
- “Practice and assessments are untimed, formative, and award no XP.”
- “Include relevant YouTube learning links without autoplay or embedding unverified videos. Use topic-specific YouTube search links that students can choose to open.”
- “Provide page-specific skeleton layouts during initial auth/data loading, with reduced-motion support and a clear error state if loading fails.”

## Review Focus

- A returning learner with all lessons complete must get a useful next action, not an undefined lesson link; test with all three lesson IDs completed.
- Guest and signed-in nickname updates must persist through their existing adapter paths without allowing changes to XP or completion; test the state update contract and manually smoke guest/account paths.
- Missing/empty quiz questions must not break Practice or Assessments; test empty pool and undersized pool behavior.
- Unknown topic/lesson IDs in URLs must resolve to a safe available lesson, never render unsafe markup or appear completed; test malformed and unknown query IDs.
- Failed initial auth/data loading and failed saves must show distinct, accessible recovery/error feedback rather than a permanent skeleton or a success state; exercise failure paths in browser smoke.

---

### Task 1: Add tested learning, validation, and skeleton helpers

**Files:**
- Create: `js/core/learning.mjs`
- Create: `js/core/auth-validation.mjs`
- Create: `js/components/loading.js`
- Create: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Produces `getNextLesson(lessons, completedIds) -> lesson | null`, `getTopicProgress(topic, completedIds) -> { completed, total, percent }`, and `youtubeSearchUrl(query) -> string`.
- Produces `validateAuthFields(fields, mode) -> { [fieldName]: string }`, with `mode` equal to `'login'` or `'signup'`.
- Produces `renderPageSkeleton(page) -> HTML string`, with distinct skeletons for `dashboard`, `courses`, `lessons`, `quizzes`, `profile`, `progress`, `practice`, `assessments`, and the login form; unknown page names use a neutral skeleton.

- [x] **Step 1: Write helper tests** for next lesson including complete-course behavior, topic progress for empty and partial topics, encoded HTTPS YouTube search URLs, login/signup field errors, and distinct page skeleton labels/roles.
- [x] **Step 2: Run `node scripts/test-learning-experience.mjs`** and confirm the new imports fail because helpers are absent.
- [x] **Step 3: Implement the pure helpers** in the three production modules; keep validation messages concise and skeletons semantic with `aria-busy`/screen-reader labels.
- [x] **Step 4: Run `node scripts/test-learning-experience.mjs`**; all helper tests must pass.
- [x] **Step 5: Run the existing `node scripts/test-quizzes.mjs`** to confirm the existing quiz shell contract remains intact.

### Task 2: Improve Dashboard, Courses, and Lessons

**Files:**
- Create: `js/pages/learning-views.js`
- Modify: `js/pages/app.js`
- Modify: `css/pages.css`
- Test: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes Task 1 learning helpers and the existing topics/lesson/state data.
- Produces `dashboardView(topics, lessons, state, attempts)`, `coursesView(topics, lessons, state)`, and `lessonsView(lessons, state, lessonId)` returning escaped HTML. Static lesson SVG diagrams remain trusted authored data and render as figures with preserved accessible labels.

- [x] **Step 1: Add tests** for data-derived next lesson/progress/resource behavior, including all Logic lessons complete and unknown lesson IDs.
- [x] **Step 2: Run the targeted tests** and confirm the new view exports/behavior are absent.
- [x] **Step 3: Implement the three views** with clear Continue Learning, course status/lesson links, lesson sequence and progress, section headings, existing revealable self-checks, and relevant external YouTube search links.
- [x] **Step 4: Wire page rendering and existing lesson/theme/completion actions** in `app.js`; keep quiz rendering unchanged.
- [x] **Step 5: Run learning and quiz test scripts**; both must pass.

### Task 3: Build useful Profile and Progress pages

**Files:**
- Create: `js/pages/student-views.js`
- Modify: `js/pages/app.js`
- Test: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes `getCurrentUser()`, `getState()`, `saveState()`, topics, lessons, and quiz attempts from existing modules.
- Produces `profileView(user, state) -> HTML string` and `progressView(topics, lessons, state, attempts) -> HTML string`.

- [x] **Step 1: Add tests** for profile guest/account labels and progress totals across partial/complete Logic, including accessible non-color progress labels.
- [x] **Step 2: Run the targeted tests** and confirm these view exports/behaviors are absent.
- [x] **Step 3: Implement Profile** with a nickname form constrained to the existing 3–32 character rules, guest/signed-in status, safe sync explanation, and signed-in logout action.
- [x] **Step 4: Implement Progress** with XP/level/streak, Logic lesson completion, topic availability, and recent attempts when available; distinguish unavailable history from empty history.
- [x] **Step 5: Wire nickname saving through `saveState()` and logout through `signOut()`** without granting profile access or changing XP/progress.
- [x] **Step 6: Run learning and quiz test scripts**; both must pass.

### Task 4: Add interactive Practice and formative Assessments

**Files:**
- Create: `js/pages/practice-views.js`
- Modify: `js/pages/app.js`
- Modify: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes the existing validated Logic question bank, `scoreQuiz`, and `selectMixedQuestions`.
- Produces `practiceView(bank)`, `assessmentView(bank)`, and reusable question selection based only on available questions. Practice gives per-question feedback; Assessments present an untimed checkpoint and end-of-checkpoint review. Neither awards XP.

- [x] **Step 1: Add tests** for unique selections, empty/undersized question banks, score/review behavior, and no XP side effects from practice/assessment completion.
- [x] **Step 2: Run the targeted tests** and confirm the new view behavior is absent.
- [x] **Step 3: Implement Practice** with lesson-focused and mixed question starts, immediate explanations, retry, and clear quiz-page distinction.
- [x] **Step 4: Implement Assessments** as an untimed Logic checkpoint using only available questions, with review and practice-only score language.
- [x] **Step 5: Wire keyboard-operable controls and transient results** without adding schema or changing XP/lesson state.
- [x] **Step 6: Run learning and quiz test scripts**; both must pass.

### Task 5: Improve login/signup form alignment and validation

**Files:**
- Modify: `js/pages/login.js`
- Modify: `css/pages.css`
- Modify: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes `validateAuthFields(fields, mode)` from Task 1 and existing auth/resend functions.
- Preserves `signIn`, `signUp`, guest continuation, Supabase-unconfigured messaging, email-confirmation behavior, and resend confirmation.

- [x] **Step 1: Extend validation tests** for invalid email, missing/invalid nickname, short password, and valid login/signup values.
- [x] **Step 2: Run the focused validation tests** and confirm they catch each invalid field.
- [x] **Step 3: Update the form** with aligned visible labels, inline field errors linked via `aria-describedby`, focused error summary, disabled/loading feedback, and preserved email after failure.
- [x] **Step 4: Update responsive login/signup styles** while keeping the shared design tokens and visible focus.
- [x] **Step 5: Run learning and quiz test scripts**; both must pass.

### Task 6: Wire page-specific skeletons and finish accessibility/readability

**Files:**
- Modify: `js/pages/app.js`
- Modify: `js/pages/login.js`
- Modify: `css/layout.css`
- Modify: `css/pages.css`
- Modify: `scripts/test-learning-experience.mjs`

**Interfaces:**
- Consumes `renderPageSkeleton(page)` from Task 1 and all page views from Tasks 2–5.
- The app root shows the matching skeleton before awaiting auth/theme/data; success replaces it and sets `aria-busy="false"`. A failure replaces it with an explicit error and retry control. Login has an aligned form skeleton and an explicit connection failure state.

- [x] **Step 1: Add an integration test** that each supported page returns a distinct labeled skeleton and unknown pages safely use the neutral variant.
- [x] **Step 2: Run the focused test** and verify it fails if any page skeleton is omitted or duplicated.
- [x] **Step 3: Wire initial skeletons, failure recovery, and retry** without hiding actual errors or leaving `aria-busy` stuck.
- [x] **Step 4: Fix sidebar note contrast in light/dark themes** and verify authored diagrams, cards, muted text, focus, and disabled/error states maintain readable contrast; preserve the current brand palette.
- [x] **Step 5: Keep five mobile navigation controls** for Dashboard, Courses, Lessons, Practice, and a keyboard-operable More menu; put Quizzes, Assessments, Progress, and Profile in More. Test that all four remain discoverable and operable without horizontal overflow or safe-area overlap.
- [x] **Step 6: Run all test scripts, data validation, and JavaScript syntax checks**; all must pass.
- [x] **Step 7: Browser-smoke** Dashboard, Courses, all three Lessons, Profile, Progress, Practice, Assessments, login/signup, skeletons and failure states in light/dark themes and at 390px/desktop widths, including keyboard navigation and YouTube external-link behavior.
