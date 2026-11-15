# Dashboard review and daily activity design

## Intent

Make the dashboard more useful for choosing today's next study action without making it visually dense.

## Goals

- Add a daily goal beside the existing streak, with choices of one newly completed lesson or ten distinct flashcards revealed. Default to one lesson; save the choice locally.
- Add a compact review card based on missed questions from the learner's three latest quiz attempts, grouped by lesson and ordered by number missed.
- Show the three latest study activities beneath the study-tool links.
- Show current FVC or instructor notices and deadlines from a small site-maintained content file.
- Keep existing dashboard content, theme, responsiveness, and account behavior intact.

## Approaches

- **Local-first (selected):** record study events and missed question IDs on this device; load notices from a repository content file. Small scope, no new backend or instructor publishing interface, but activity does not sync across devices and notices require a site update.
- **Instructor-managed:** sync activity and missed-question details and provide a protected notice-publishing workflow. Supports cross-device history and instructor editing, but requires backend schema, permissions, and administration work.

## Behavior and constraints

- Keep a bounded local activity history for completed lessons, distinct flashcards revealed, and quiz attempts. Separate signed-in and guest histories; do not send this history to Supabase.
- Count only newly completed lessons and unique flashcards revealed on the current local calendar day toward the selected goal.
- Include missed questions from the three latest attempts in the review card, with links to their lessons. Show a short empty state when there are no misses or no attempts.
- Read notices from `data/dashboard-notices.json`, showing only notices whose publication/expiry dates make them current. Start with an empty list rather than inventing official FVC information. Each notice identifies its source.
- Limit the recent-activity list to three short entries. Keep the existing visual style and use clear labels, keyboard-accessible controls, and responsive layout.

## Out of scope

Cross-device activity sync, instructor/admin publishing UI, push notifications, and changes to other pages.
