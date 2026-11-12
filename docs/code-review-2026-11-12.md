# Code review: DiscreteFisher Hub (working tree of 12 Nov 2026)

Format follows the superpowers `requesting-code-review` reviewer template. Review was done in one
pass by the author of the changes (no reviewer subagent was available in that session), so treat
it as a self-review and re-check anything you disagree with.

**Reviewed:** every file under `js/` (except `vendor/`), `css/`, `pages/`, `data/`, `scripts/`,
`supabase/`, and the two ignored `.superpowers` plans.
**Method:** read the code, ran the existing tests, linted with ESLint `no-undef`, measured WCAG
contrast on the design tokens, then wrote `scripts/test-app-smoke.mjs` to load each real page
in jsdom and click through it. The smoke test failed 9 of 21 cases on the original code.

## Strengths

- Row-level security is thoughtful: clients can only change `nickname`; XP, level and streak are
  derived by database triggers; the leaderboard view exposes only `nickname` and `xp`.
- Accessibility basics were already there: skip link, `aria-live` status regions, focus moved
  to headings after each step, text labels next to every color signal, reduced-motion support.
- Pure logic is separated into `.mjs` modules and unit-tested; lesson and quiz data are validated.
- Per-page lazy loading of view modules, skeleton loading states, and honest "not an official
  syllabus" labelling.

## Issues

### Critical (fixed)

1. **Practice and Assessments were broken.** `app.js` called `selectPracticeQuestions`,
   `selectAssessmentQuestions`, `practiceResultsView` and `assessmentResultsView` without ever
   importing them, and `scoreQuiz` was only assigned on the Quizzes page. Pressing *Start* threw a
   `ReferenceError`; finishing a set would have thrown a `TypeError`. The existing tests passed
   because they only import the pure modules, never `app.js`.
   *Fix:* the page now keeps handles to the view modules it loaded, and loads `quiz.mjs` on all
   three quiz-style pages. *Guard:* ESLint `no-undef` and the smoke tests.
2. **"Mark lesson complete" never updated its button or showed the level-up message.** The handler
   read `event.currentTarget` after an `await`; the DOM resets it to `null` once the handler
   yields, so it threw after the progress was already saved. *Fix:* keep the button in a variable,
   and re-enable it with an error message if saving fails.

### Important (fixed)

3. **Every page downloaded and parsed the 220 KB Supabase client**, even for guests, and three
   pages also had it as a blocking `<script>`. It now loads only for a saved session, a
   confirmation-email link, signing in, or the leaderboard. Page data also starts downloading in
   parallel with the session check, and the dashboard paints before the leaderboard arrives.
4. **Config was fragile.** `config.js` was git-ignored, so production fell back to
   `config.example.js` after a failed request (a 404 on every page), and the two files exported
   different names (`SUPABASE_ANON_KEY` vs `SUPABASE_PUBLISHABLE_KEY`). Now there is one committed
   `config.js` holding only the publishable key.
5. **Streaks used the UTC date.** In the Philippines the "day" rolled over at 8:00 AM. Guest
   streaks now use local time (`js/core/dates.mjs`, tested under `Asia/Manila`). Signed-in streaks
   are computed in SQL; the optional migration fixes that side.
6. **Form-field borders had 1.5:1 contrast** (WCAG 1.4.11 asks for 3:1). New `--field-border`
   token (4.0:1 light, 4.6:1 dark).
7. **The Supabase script could hang forever** on a stalled network, leaving "Loading…" with no
   way out. It now times out after 10 seconds with an error message.
8. **Raw sign-in errors** ("Invalid login credentials", "Email not confirmed") are now friendly
   messages; the second points to *Resend confirmation email*.
9. **Duplicated code:** the HTML escape helper existed five times (one version did not escape
   `'`) and credential validation twice. Each now has a single source.
10. **Repository hygiene:** two files named `h origin main` and `witch -c learning-ux-speed-improvements`
    (output of mistyped git commands) were committed; `README.md` was UTF-16 and contained only a
    title; `git diff HEAD` showed 2,749 changed lines that were only line endings.
    Added `.gitattributes`, a real README, and removed the stray files.
11. **Latent bug:** every "Try it" answer in a lesson shared one element id (`answer-<lesson id>`)
    and only the first Reveal button was wired. Ids are now per section.
12. **Answer-position pattern:** the right choice was third in 8 of 15 questions. Choices are now
    shuffled on every attempt (`shuffleChoices`, tested).

### Minor / recommended next (not changed)

- `app.js` is still about 480 lines and `render()` is about 150. Move the quiz and practice
  sessions into their own modules next.
- `css/pages.css` is minified and append-only (some rules appear twice, for example `.field-error`).
  Run Prettier over `css/` in a separate commit so the diff is reviewable.
- The app is hard-wired to one topic: `page-data.mjs` loads `logic.json`, and
  `validateQuizBank` requires `topicId === 'logic'` and exactly five questions per quiz. Adding
  Set Theory means generalising those first.
- Streak meaning differs: for guests it counts days visited; for signed-in learners it only
  moves when a lesson is completed (the database updates it on lesson rows). The Progress page
  calls it "a visit streak".
- Nickname-taken detection matches the text "database error saving new user", which is brittle.
- The leaderboard is public by design. Say so in the sign-up form so nobody uses a real name by accident.
- The Content-Security-Policy in `vercel.json` is **report-only**. After deploying, open the browser
  console on each page; if nothing is reported, rename the header to `Content-Security-Policy`.

## Declined to judge

- Visual design in a real browser: this review had no browser, so layout, spacing and the new
  explorer's appearance were checked by reading the CSS and measuring contrast, not by eye.
- Mathematical wording of lesson prose: the 15 quiz answer keys were read and are correct, but
  the lesson text was not reviewed by a subject expert.
- Supabase dashboard settings (SMTP, redirect URLs, rate limits): not visible from the repository.
- Email deliverability (spam folder): depends on the sending domain, not on this code.

## Assessment

Ready to merge after the author runs the app once in a browser (Practice, Assessments and
marking a lesson complete were the broken flows). `npm run check` passes from a clean install.
