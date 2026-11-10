# Quizzes design

## Intent

Replace the Quizzes placeholder with useful, low-pressure practice for DiscreteFisher Hub learners. Start with the three complete Logic lessons so learners can check understanding and see what to revisit.

## Goals and non-goals

- Offer one short quiz per available Logic lesson and a mixed Logic review.
- Give immediate, accessible feedback with an explanation for every answer.
- Show a score, let learners review missed questions, and allow another attempt.
- Save attempt history locally for guests and to Supabase for signed-in learners.
- Keep quizzes untimed, ungraded, and separate from XP and lesson completion.
- Leave topics without lesson/question content unavailable; do not imply their quizzes exist.
- Do not add a leaderboard, exam mode, or new framework/dependencies.
- Include Quizzes in the five-item mobile quick navigation, replacing the currently empty Practice entry.

## Constraints

- The app uses vanilla HTML, CSS, and JavaScript with static lesson JSON.
- Logic is the only topic with completed lessons; each lesson has a self-check and answer, not a structured question bank.
- `quiz_attempts` already stores user, topic, mode, score, total, and timestamp. Signed-in quiz attempts are not yet wired through the client.
- Preserve the shared app shell, theme support, mobile layout, and keyboard focus behavior.

## Approaches

1. **Lesson self-checks only:** smallest change, but leaves the Quizzes page without a useful role.
2. **Standalone lesson-based practice (selected):** dedicated quizzes, immediate explanations, missed-question review, mixed review, and saved history. This adds a complete learning loop while remaining low-stakes and scoped to available content.
3. **Timed exam mode:** adds assessment pressure and requires a larger question bank; premature for the current content.

## Design and implementation calls

- Create an authored, static question bank with five questions for each of the three current Logic lessons.
- Use single-answer multiple-choice questions, one at a time, with clear progress and immediate rationale.
- The mixed review selects five unique questions from the same Logic question bank.
- Keep attempts ungraded and do not award XP; the existing product rule awards XP only for completed lessons.
- Store the latest 20 guest attempts locally and signed-in attempts in the existing Supabase table. Surface persistence errors instead of showing a successful save.
- Make unavailable topics visibly unavailable until both lesson content and quiz questions exist.
- Use the current visual system, responsive layout, semantic controls, and visible keyboard focus.
- Make the new quiz experience discoverable on mobile without expanding the quick navigation beyond five links.
