# Learning hub renovation design

## Intent

Refresh Dashboard, Courses, Lessons, Flashcards, Practice, Quizzes, Assessments, Progress, and Profile around the learner-focused visual direction in the supplied reference. Review each page's mockup with the user before implementing that page.

## Goals

- Establish a calm study-space feel with a light navigation rail, pale neutral canvas, white content cards, and navy/gold emphasis.
- Make each page's primary learning action and current course state easy to find.
- Keep all nine destinations accessible in the shared navigation and responsive mobile navigation.
- Preserve existing learning, account, profile, and progress behavior.

## Chosen approach

Extend the existing vanilla JavaScript page views, shared shell, and CSS. This reuses the app's current routing, data, and state behavior without adding a framework or dependencies.

Alternatives considered:

- Build a parallel set of static pages: rejected because it would duplicate navigation and behavior and would not renovate the pages learners actually use.
- Migrate the app to a framework: rejected because a visual refresh does not justify expanding the build and dependency surface.

## Page-by-page review

Work in the user's requested order. For each page, first show a browser mockup and wait for the user's direction; implement only after that page's mockup is selected. Then move to the next page.

### Dashboard

The user selected **B · Compact study-first**. Lead with the welcome and next lesson, followed by learning totals, the Logic pathway, and study tools. Retain the dashboard's existing data and interactions—including daily goal, review prompts, notices, recent activity, and quiz history—placing supporting details below the primary study path as needed. Use live app state rather than the mockup's sample values.

### Courses

The user selected **A · Course catalogue**. Lead with a catalogue heading and clear counts/status for courses available now versus in preparation. Feature the published Logic course with its live completion progress, all three lesson links, and the existing start/continue action. Show the eight unavailable topics below as non-actionable entries with accurate preparation status. Preserve existing course data and use live learner progress; mockup sample values are illustrative only.

### Lessons

The user selected **A · Focused lesson reader**. Give the lesson text a wide, calm reading column, with course progress and section navigation near the top. Preserve the Logic lesson pathway, lesson completion and XP, section examples, truth-table interaction, self-check reveal, resources, and previous/next navigation.

### Flashcards

The user selected **A · Single-card focus**. Center one current Logic question and its choices, with deck progress and reveal/previous/next controls close to the card. Preserve the data-driven 15-card deck, hidden-answer reveal, explanation, keyboard focus behavior, and existing first/last-card control states.

### Practice

The user selected **A · Lesson sets first**. Lead with the three existing lesson-specific Logic practice sets as the primary choices, showing their current question counts and start actions. Keep the existing mixed review visible as a secondary option, and preserve the current five-question cap, immediate explanations, no-XP behavior, and no effect on lesson progress.

### Quizzes

The user selected **A · Quiz catalogue**. Lead with the three available lesson-specific Logic quizzes, including their live latest-attempt status and start actions. Keep the existing mixed review visible after the lesson quizzes, followed by recent attempts and the eight topics marked not available yet. Preserve quiz behavior, saved history, explanations, retry-missed flow, and the no-XP/no-lesson-progress rules.

### Assessments

The user selected **A · Checkpoint overview**. Introduce the existing Logic checkpoint with a clear start action and concise facts about the current question count, untimed pace, and no-XP/no-grade nature. Explain the question-by-question flow and that answers are reviewed after submission. Derive the available count from the question bank; preserve the current readiness threshold, checkpoint questions, scoring, answer-review behavior, and no-XP/no-lesson-progress rules. Do not invent grades or learner progress.

The rejected **B · Coverage-first** option would list the lesson question pool beside a compact launch panel. The overview was selected to set expectations before one clear action without implying that learners can choose which lessons or questions enter the checkpoint.

### Progress

The user selected **A · Course-first pathway**. Lead with the published Logic course completion and its three lesson statuses; keep XP, level, streak, and quiz history secondary. Keep the eight other topics visible as non-actionable coming-soon content below the primary course path. Use actual saved learner state, preserve lesson links, quiz history and its empty/error states, and keep practice scores distinct from XP and course progress.

The rejected **B · Learning record** option would place recent quiz activity ahead of the course pathway. The course-first direction keeps lesson completion as the primary progress signal while retaining practice history as supporting information.

### Profile

The user selected **A · Profile card + settings**. Keep the learner summary beside the grouped preferences form on desktop, with Account and privacy below; stack these sections on small screens. Preserve the existing nickname, program/year, study-rhythm, reminders/display, account-security, and privacy content and interactions.

The rejected **B · Settings workspace** option would place a compact identity banner above separate settings panels. The selected A layout gives the learner summary more context alongside the controls.

## Constraints

- Build on the existing shared shell, router, page renderers, and CSS.
- Preserve all pre-existing worktree changes; integrate rather than replace them.
- Do not invent course availability, learner progress, notices, or assessment claims.
- Preserve light/dark theme behavior, keyboard focus, readable contrast, reduced-motion support, and small-screen navigation.
- No new backend, schema, dependencies, or unrelated behavior changes.

## Non-goals

This is a visual and layout renovation, not a content expansion or learning-system rewrite. Do not change authentication, course data, scoring, XP rules, or persistence semantics.

## Acceptance criteria

- Each requested page receives a user-reviewed mockup before its implementation begins.
- The Dashboard follows the selected compact study-first direction while retaining existing live data and functionality.
- Remaining pages preserve their existing behavior while adopting the visual direction approved for each page.
- Existing navigation, theme, responsive, accessibility, and smoke-test expectations continue to pass.
