# Auth Screen Design

## Intent

Make the login, signup, email-link, forgot-password, and reset-password screens feel like one clear, polished flow. Fix the crowded secondary links and make confirmation help easy to find, while keeping the centered-card layout selected in mockup A.

## Goals

- Keep the existing centered card, light palette, and DiscreteFisher Hub branding.
- Give each action its own readable spacing and hierarchy; never let secondary links run together.
- Keep form labels, helper text, field errors, submission feedback, and recovery links legible on desktop and mobile.
- Make the login error state explain the next step and present “Resend confirmation email” as a distinct action.
- Retain Google sign-in on login/signup and email-link pages, plus the guest option where it exists today.

## Non-goals

- Do not change Supabase configuration, authentication logic, database behavior, redirects, or email delivery.
- Do not add a split brand panel, new providers, or new account flows.
- Do not change security-sensitive generic messaging about whether an account exists.

## Approaches

- **A — Refined centered card (selected):** Stay close to the provided screenshots and current page structure; improve spacing, action grouping, and error/status presentation. This is the closest fit and keeps the change focused.
- **B — Campus-branded split layout (not selected):** Add a school panel beside the form on wide screens. It adds identity but uses more space and diverges from the screenshots.

## Constraints and implementation calls

- Use the existing vanilla JavaScript renderers, CSS tokens, and auth page wrappers.
- Keep changes limited to auth-page presentation and directly related markup in login, magic-link, forgot-password, and reset-password screens.
- Preserve all existing form behavior and accessible labels, focus handling, status announcements, and keyboard focus styles.

## Acceptance

- The five auth screens share the centered-card visual system.
- Secondary actions have visible separation at desktop and mobile widths; the resend-confirmation action is clear in the login error state.
- Existing authentication behavior and all current routes remain unchanged.
