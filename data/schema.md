# Data schema

`topics.json` is an array of topic objects: `id` (unique string), `title` (string), `scopeLabel` (`CHED-aligned scope` or `Supplementary`), `summary` (string), and `lessonIds` (string array).

`lessons/*.json` contains one `topicId` and a `lessons` array. Each lesson has `id`, `title`, positive integer `xp`, and `sections`. A section has `heading`, `body`, and may contain an inline SVG `diagram` plus a `tryAnswer`. Content is trusted, authored local JSON and rendered as lesson HTML.

Learner data is not part of these files. It is stored only through `js/core/storage.js` under the `dfh:` prefix.
