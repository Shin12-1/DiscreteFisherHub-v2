# Profile visual renovation design

## Intent

Make Profile a calm, easy-to-scan place for learners to manage their identity, study preferences, and account options without changing how those settings work.

## User and goals

- Give the learner identity a clear home beside the settings.
- Group personal details, study rhythm, and reminders/display controls so they are easy to scan.
- Keep account and privacy actions visible without mixing them into preference fields.
- Preserve the current guest and signed-in experiences, labels, validation, and save feedback.

## Chosen approach

The user selected **A · Profile card + settings** in the Profile mockup. On desktop, keep the learner summary in a card beside the grouped preferences form; place account and privacy beneath. On smaller screens, stack the summary, form, and account section in that order.

### Alternatives considered

- **A · Profile card + settings — selected.** Keeps identity and editable preferences visible together, while preserving a clear place for account actions.
- **B · Settings workspace — rejected.** Uses a compact identity banner followed by separate settings panels. It is scannable, but gives less space to the identity summary that contextualizes the page.

## Page structure

1. Retain the Profile introduction and its short explanation.
2. Show the learner summary card beside the preferences form:
   - Summary: avatar initial, nickname, guest/account status, program, and year level.
   - Personal details: nickname, program, and year level.
   - Study rhythm: weekly goal, session length, preferred time, and lesson support.
   - Reminders and display: appearance, study reminders, assessment updates, reduced motion, and the existing local-only reminder note.
   - Keep the existing save action and its status/error feedback.
3. Keep Account and privacy below both columns:
   - Guests retain the sign-in-to-sync action and current privacy copy.
   - Signed-in learners retain the email, account privacy copy, change-email and reauthentication links, and logout action.

## Behavior and constraints

- Continue using the existing `profileView(user, state)` renderer, shared shell, profile form handlers, and CSS tokens/card patterns.
- Do not change nickname validation, preference defaults, persistence, authentication, or account-security flows.
- Nickname and theme continue using learner state; study preferences remain local. Signed-in nickname updates keep their existing account sync behavior.
- Theme and reduced-motion settings continue applying when settings are saved. Reminder preferences remain local and do not send notifications.
- Preserve visible keyboard focus, readable light/dark themes, responsive single-column behavior, and mobile navigation.
- Do not add fields, account actions, backend changes, or dependencies.

## Acceptance criteria

- The selected A layout is implemented with the learner summary beside the grouped settings on desktop and stacked before them on small screens.
- All current fields, labels, account actions, and privacy explanations remain available in their appropriate guest/signed-in states.
- Existing validation, save feedback, local preference persistence, signed-in nickname sync, theme, and reduced-motion behavior remain unchanged.
- Existing Profile tests and the full project check pass; browser review confirms no horizontal overflow and visible keyboard focus at desktop, tablet, and mobile sizes in light and dark themes.
