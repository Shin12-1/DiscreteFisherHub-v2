# Data schema

`topics.json` is an array of topic objects: `id` (unique string), `title` (string), `scopeLabel` (`CHED-aligned scope` or `Supplementary`), `summary` (string), and `lessonIds` (string array).

`lessons/*.json` contains one `topicId` and a `lessons` array. Each lesson has `id`, `title`, positive integer `xp`, and `sections`. A section has `heading`, `body`, and may contain an inline SVG `diagram`, a `tryAnswer`, and a `widget` (currently only `"truth-table"`, the interactive explorer; `scripts/validate-data.mjs` rejects unknown names). Content is trusted, authored local JSON and rendered as lesson HTML.

`quizzes/*.json` contains the quiz question bank. Questions may include a `tags` string array for concept-specific activity tracking; each tag must be non-empty.

Learner data is not part of these files. It is stored only through `js/core/storage.js` under the `dfh:` prefix.

`achievements.json` contains an `achievements` array with stable kebab-case `id`, `title`, `description`, `category`, boolean `hidden` and `available` flags, and a typed `criteria` object. Optional `rewards.title` entries grant selectable profile titles. Hidden locked achievements are presented without their title or criteria. The server-side migration uses the same IDs and criteria rule keys when awarding signed-in learners, including the period-scoped weekly badge.

`weekly-challenges.json` contains a `challenges` array with stable IDs, display text, a rule key, positive target, unit, and the badge metadata awarded for completing that challenge. `js/core/weekly-challenge.mjs` selects one challenge per ISO week in `Asia/Manila`; the period key is retained with the unlock so a later weekly award is distinct.
