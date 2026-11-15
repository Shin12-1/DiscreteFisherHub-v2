# DiscreteFisher Hub Homepage Renovation

## Intent

Renovate the public homepage so Fisher Valley College BSCS and BSIT students can quickly understand the study hub and choose a useful next step. The current homepage is being reconsidered through three visual concepts; the user selected **A — Academic clarity**.

## Goals

- Apply the selected academic, bright, structured direction to the real homepage.
- Make “Start learning” and topic discovery immediately clear.
- Present the course topics and study rhythm in a polished, responsive layout.
- Preserve existing account, local-first study, theme, and topic-loading behavior.

## Non-goals

- Redesigning authenticated application pages or the course experience.
- Changing authentication, progress, persistence, topic data, or theme behavior.
- Adding dependencies, remote fonts, or new image assets.
- Replacing the independently viewable mockup review page.

## Anti-goals

- Do not turn the homepage into a static marketing page that loses live topic data or progress-aware actions.
- Do not require sign-in before a student can begin learning.
- Do not add decorative interactions or animation that distract from learning.

## Approaches considered

1. **A — Academic clarity (selected):** Bright, structured layout; clear learning CTA; campus image with a restrained logic detail; topic map; concise study-flow section. This best fits the selected mockup and the existing college identity.
2. **B — Editorial focus:** Warm paper-like palette, serif-led typography, and a more magazine-like narrative. Distinctive, but less consistent with the current app’s visual language.
3. **C — Practice first:** More product-led and action-oriented, with topic discovery and practice emphasized. Useful, but less balanced as a first introduction to the hub.

## Design and behavior

- Keep the existing brand and navigation, including the account-sensitive Dashboard/Log in link and the accessible theme toggle.
- Rework the hero to pair a clear value proposition and primary “Start learning” action with the existing campus image. Preserve the existing progress-aware “Continue learning” state for learners with progress.
- Keep “Browse topics” and practice destinations as secondary actions; maintain usable links to courses, practice, flashcards, and quizzes without crowding the hero.
- Keep the topic preview data-driven from `data/topics.json`, including every available topic and its current scope label and summary. The six topics in the visual mockup are only illustrative.
- Rework the study-loop section and footer to match the selected visual direction while retaining their existing informational role and disclaimer.
- Support the existing saved light/dark theme, keyboard navigation, visible focus, reduced motion, and narrow/mobile viewports.

## Constraints

- The site is plain HTML/CSS/JavaScript with no UI framework; follow existing patterns.
- `js/pages/home.js` expects `#topic-preview` and `[data-theme-toggle]` in the rendered page.
- `homeAction` currently reflects sign-in/progress state and must remain functional.
- Existing local assets and theme tokens should be reused where appropriate.

## Acceptance criteria

- The live homepage reflects direction A and retains the complete topic list from `data/topics.json`.
- Guest, signed-in, and returning learner hero actions keep their current destinations and intent.
- Theme switching still works; the theme control remains accessible.
- The page has no horizontal overflow at mobile widths and remains readable at desktop widths.
- Existing smoke tests pass, with focused homepage assertions added if needed for any behavior otherwise left unprotected.
- No unrelated modified files are changed.

## Left to the builder

The builder may refine exact spacing, typography scale, card treatment, and responsive breakpoints to fit the existing CSS tokens and app conventions. Any deviation from the selected direction or preservation requirements should be raised before implementation.
