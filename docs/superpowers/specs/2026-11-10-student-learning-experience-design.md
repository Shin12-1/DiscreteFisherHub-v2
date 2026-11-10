# Student learning experience

## Intent

Make DiscreteFisher Hub easier for BSCS/BSIT students to read, navigate, and use for a complete self-study loop. Improve the existing Dashboard, Courses, Lessons, and sign-in/sign-up experience; replace the Profile, Progress, Practice, and Assessments placeholders with useful features; and show skeleton feedback while each page loads.

## Goals

- Make the current Logic content and the next useful action obvious without implying other course content already exists.
- Improve course and lesson navigation, lesson comprehension, practice engagement, and progress visibility.
- Build Profile, Progress, Practice, and Assessments from the existing local learner state, Logic lessons, and quiz bank.
- Keep personal data local for guests and use the existing Supabase auth/profile/progress APIs for signed-in learners. Do not introduce new tables or expose other learners' records.
- Include relevant YouTube learning links without autoplay or embedding unverified videos. Use topic-specific YouTube search links that students can choose to open.
- Ensure primary text and controls remain readable in both themes, including the sidebar note and lesson diagrams shown in the supplied screenshots.
- Provide page-specific skeleton layouts during initial auth/data loading, with reduced-motion support and a clear error state if loading fails.
- Improve login/sign-up alignment, inline validation, keyboard and screen-reader feedback, and submit/loading states.
- Preserve the existing quiz experience, no-XP quiz rule, shared shell, and five-item mobile navigation.

## Non-goals

- Claiming coverage for topics with no authored lessons or quizzes.
- Awarding XP for quiz, practice, or assessment activity.
- Adding a new framework, dependency, analytics, leaderboard, remote video embed, or assessment timer.
- Persisting assessment or practice scores in a new database schema.
- Collecting sensitive personal information beyond the existing email and nickname.

## Approaches considered

1. **Independent static pages:** add separate scripts and duplicated page markup for each destination. This limits edits in the current renderer but duplicates loading, theme, navigation, and state behavior.
2. **Extend the existing shared renderer (selected):** add small page renderers and interactions to the existing vanilla app, continue using current state/auth/quiz APIs, and share loading, resource, and progress helpers. This keeps the established deployment simple and avoids introducing dependencies.
3. **Migrate to a UI framework:** could provide component reuse but changes the build, deployment, and dependency surface without helping the current static-content scope; rejected.

## Experience outline

- **Dashboard:** personalized welcome, a clear Continue Learning action, lesson progress, study streak/XP, recent quiz activity when available, and curated next steps. Empty progress gets a welcoming first-study path.
- **Courses:** honest availability/status, detailed Logic overview, navigable lesson list, current progress, and course-specific video-search links. Unwritten topics remain clearly marked as coming later and are not dead-end links.
- **Lessons:** stronger readable hierarchy, lesson navigation/progress, small section-level interactions that reveal/recall lesson ideas, visible completion, and optional YouTube searches related to each lesson. Existing lesson text and SVG semantics are preserved.
- **Profile:** show guest or signed-in status, let the learner edit their nickname using the existing state/auth path, and provide logout for signed-in users.
- **Progress:** show course/lesson completion and current XP/level/streak with text labels in addition to visual indicators.
- **Practice:** offer an untimed question flow using the existing Logic question bank, immediate explanations, retry, and no XP; keep it distinct from the existing lesson quiz lobby.
- **Assessments:** offer an untimed, formative Logic checkpoint assembled from available questions, with a transparent practice-only score and review. Do not claim formal grading or alter lesson/XP progress.
- **Login/sign-up:** use a clearer, responsive single-column form with persistent labels, inline field errors, an accessible error summary, disabled/loading feedback, and the existing guest/resend-confirmation paths.
- **Skeletons:** show a page-shaped, accessible skeleton immediately while auth and page data load; use CSS animation only when motion is allowed; remove it on success or replace it with an explicit error/retry state.
- **YouTube resources:** render labeled external YouTube search links using encoded topic/lesson concepts; open in a new tab with safe `rel` attributes. Do not autoplay or embed.

## Constraints and decisions

- Implementation stays in vanilla HTML, CSS, and JavaScript ES modules.
- Existing data files and local/Supabase adapters remain authoritative.
- Logic lessons are the only authored lesson content; no invented completion states for the other eight topics.
- Maintain keyboard access, visible focus, touch-sized actions, reduced motion, and WCAG AA text contrast (4.5:1 for normal text) in light and dark themes.
- Keep all new actions operable by keyboard; convey correctness, progress, and errors with text, not color alone.
- The screenshots reveal that `.side-note` currently uses pale text on the light `surface-soft` background in light mode. Correct this at the semantic token level instead of changing the site's whole brand palette.
- The user authorized autonomous decisions and requested implementation; proceed with the selected approach without pausing for an intermediate design approval.

## Acceptance criteria

- All eight named destinations render intended content and contain no generic placeholder state.
- Dashboard, Courses, Lessons, Profile, Progress, Practice, Assessments, and Login have distinct skeletons while their initial async work is pending.
- Relevant YouTube links point to encoded topic-specific search URLs, are clearly identified as external resources, and do not autoplay.
- Guest and signed-in profile/progress paths use only existing storage and Supabase policies; nickname updates work through existing behavior.
- Practice/assessment interactions remain untimed and award no XP; quiz data remains shared and unchanged.
- Light/dark sidebar note, text, cards, and diagrams remain readable; no narrow-screen horizontal overflow.
- Login/sign-up forms provide field-level errors and preserve guest continuation/resend flows.
- Tests cover state-derived views, practice scoring/interaction helpers, skeleton generation, auth form validation, and navigation/resource contracts.
