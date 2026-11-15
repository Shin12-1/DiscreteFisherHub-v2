# DiscreteFisher Hub · FVC

A Discrete Mathematics study space for Fisher Valley College BSCS and BSIT students: lessons with
worked examples and interactive explorers, flashcards, practice, quizzes, checkpoints, progress,
streaks, achievements, learner profiles and an opt-in leaderboard.

> Student project. Not an official FVC syllabus or product.

## Run it locally

```powershell
python scripts/serve.py        # then open http://localhost:5173
```

Guests need nothing else: progress is kept in the browser. Signing in syncs progress through
Supabase (see [`supabase/README.md`](supabase/README.md)).

## Develop

```powershell
npm install        # once (Node 22 or newer)
npm run check      # lint + every test
```

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint over every script. Catches undefined names like a missing import. |
| `npm test` | Data validation, achievement/profile/share tests, and `scripts/test-app-smoke.mjs`, which loads every real page in a DOM and clicks through the main learning flows. |

GitHub Actions runs the same two commands on every push and pull request.

## How it is built

- Static site: plain HTML, CSS and ES modules. No build step. Deployed on Vercel.
- `js/pages/app.js` renders every signed-in page; views live in `js/pages/*-views.js`.
- `js/core/` holds the logic that can run without a browser (`quiz.mjs`, `learning.mjs`, `dates.mjs`, `connectives.mjs`) and is unit-tested.
- `js/core/auth.js` loads the 220 KB Supabase client only when needed (a saved session, a confirmation link, signing in, or the leaderboard), so guest pages stay light.
- Lesson content is JSON in `data/` (see `data/schema.md`); learner data is in Supabase with row-level security (`supabase/schema.sql`).
- Design tokens (colors, spacing, radius) are CSS variables in `css/tokens.css`; use them instead of raw colors.

## Profiles and sharing

Profiles and each profile section default to private. Nickname search and leaderboard participation are separate opt-ins. QR codes and downloadable SVG share cards are generated in the browser; no Vercel function or external QR service is used. See [`supabase/README.md`](supabase/README.md) for migration order and privacy verification.

## Adding content

1. Add or edit a lesson in `data/lessons/` and its five-question quiz in `data/quizzes/`.
2. Run `npm run check`. `scripts/validate-data.mjs` checks the structure.
3. Interactive explorers are lesson sections with `"widget": "truth-table"`.
