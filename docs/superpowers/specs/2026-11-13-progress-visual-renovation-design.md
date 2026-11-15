# Progress Visual Renovation Design

## Intent

Make the learner's real course and lesson completion easy to understand while keeping experience points, level, streak, and quiz practice distinct.

## Goals

- Lead with the published Logic course and its three lesson statuses.
- Keep XP, level, streak, and saved quiz history visible as supporting information.
- Keep the other eight topics visible with their existing coming-soon status.
- Reuse the current page data, lesson links, and saved progress/history behavior.

## Non-goals

- Do not change XP, level, streak, lesson completion, quiz scoring, or persistence.
- Do not add grades, badges, charts, activity records, or progress values that do not exist.
- Do not make coming-soon topics actionable.
- Do not change authentication, backend behavior, or shared navigation.

## Approaches

- **A · Course-first pathway — selected by the user.** Lead with Logic completion and its lesson checklist; show XP, level, streak, and quiz history below as supporting details. This makes lesson progress the clearest signal.
- **B · Learning record — not selected.** Lead with recent quiz activity and then show the course pathway. This emphasizes practice history, but gives quiz attempts greater prominence than lesson completion.

## Design

Use the existing Progress page heading and shared navigation. Place the Logic course completion summary first, followed by its three linked lessons and their live completion states. Show the learner's XP, level, and study streak as separate measures rather than grades. Keep saved quiz attempts in a supporting practice-history section, with the current empty state when there are no attempts and the existing error state when history fails to load. Retain the eight other topics below the primary course path with their current coming-soon copy and no start actions.

All learner-specific values and statuses must come from the existing saved state and quiz-history data. Preserve light/dark themes, visible keyboard focus, readable contrast, reduced-motion behavior, and mobile navigation.

## Implementation constraints

Keep the existing vanilla JavaScript `progressView` renderer, shared shell, and page stylesheet. No new dependencies, backend changes, or schema changes.
