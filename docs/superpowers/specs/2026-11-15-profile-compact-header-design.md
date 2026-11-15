# Profile Compact Header Design

## Intent

Reduce the space reserved for the Profile summary so learners can focus on their settings in a more balanced layout.

## Chosen approach

Use the selected **A · Compact header** layout: place the avatar, nickname, and guest/account status in a short identity strip above the full-width preferences form. Keep Account and privacy below the form. Program and year level remain in the editable form and are removed from the summary to avoid repeating them.

### Alternative considered

**B · Smaller sidebar** would keep the two-column layout while shrinking the summary to identity and status. It preserves the current arrangement but continues reserving a separate column, so it does not address the space concern as directly.

## Goals and non-goals

- Keep all existing preference fields, account actions, labels, and save/error feedback.
- Preserve guest and signed-in status, profile persistence, nickname validation, appearance, and reduced-motion behavior.
- Do not change authentication, data storage, account-security flows, or other pages.
- Do not add dependencies or new settings.

## Implementation constraints

Use the existing `profileView(user, state)` renderer, shared CSS tokens, and Profile styles. The identity strip and form should stack naturally on narrow screens, without horizontal overflow or loss of visible keyboard focus.

## Acceptance criteria

- The identity summary is a compact horizontal strip above the full-width settings form.
- The summary no longer repeats program and year level, which remain editable in the form.
- Account and privacy remains below settings, with the current guest and signed-in actions intact.
- Existing Profile behavior and project checks pass; browser review confirms the layout at desktop and mobile widths.
