# Auth Screen Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the selected centered-card design across the auth screens while preserving every existing sign-in and recovery flow.

**Architecture:** Reuse the shared `.login-card` wrapper and existing `.text-button` markup. Make a focused CSS-only change in `css/pages.css` so secondary actions stack with clear spacing and the resend-confirmation action is visually distinct.

**Tech Stack:** Vanilla HTML/CSS/JavaScript; Node.js smoke tests; local browser preview.

**Spec:** `docs/superpowers/specs/2026-11-13-auth-screen-design.md`

## Global Constraints

- Keep the existing centered card, light palette, and DiscreteFisher Hub branding.
- Do not change Supabase configuration, authentication logic, database behavior, redirects, or email delivery.
- Preserve all existing form behavior and accessible labels, focus handling, status announcements, and keyboard focus styles.
- Keep changes limited to auth-page presentation and directly related markup in login, magic-link, forgot-password, and reset-password screens.
- Do not change security-sensitive generic messaging about whether an account exists.
- Do not commit or push; leave the result for local review.

## Review Focus

- At 320px and 390px widths, long auth actions (especially “Resend confirmation email”) stay readable and do not cause horizontal overflow. Verify in the browser.
- Login errors and the resend action remain visually distinct and do not overlap. Verify the error-state mockup and the rendered login page.
- In the dark theme, links, input borders, and error/recovery actions retain readable contrast. Verify in the browser.
- Keyboard navigation can reach every auth action, with visible focus and a 44px minimum target. Verify in the browser.
- Login/signup, email-link/OTP, and password-recovery actions remain available. Verify with the auth smoke tests and route previews.

---

### Task 1: Styling shared auth actions

**Files:**
- Modify: `css/pages.css` (auth styles)
- Test: existing `scripts/test-app-smoke.mjs` (run only; no test-file change)

**Interfaces:**
- Consumes: `.login-card`, `.text-button`, `[data-resend]`, and existing auth-page tokens.
- Produces: scoped styles that give `.text-button` actions their own full-width rows and make `[data-resend]` a distinct, accessible recovery action. No new JavaScript API or auth behavior.

- [x] **Step 1: Run the auth smoke suite before editing**

Run: `node scripts/test-app-smoke.mjs`
Expected: all existing auth-page and auth-flow smoke tests pass.

- [x] **Step 2: Update the shared auth-action styles in `css/pages.css`**

Scope the new rules to `.login-card`. Stack and center existing `.text-button` actions, preserve visible focus styling and 44px minimum targets, and give `[data-resend]` a separate outlined treatment using existing surface, border, and spacing tokens. Restrict the auth pages' body minimum-width override to avoid horizontal scrolling at 320px, and use the field-border token so the resend outline remains distinct in dark mode. Leave action order, text, and markup behavior unchanged.

- [x] **Step 3: Re-run the auth smoke suite**

Run: `node scripts/test-app-smoke.mjs`
Expected: all existing auth-page and auth-flow smoke tests pass.

- [x] **Step 4: Verify the selected design in the local browser**

Inspect login/signup, email-link, forgot-password, and reset-password at desktop and 320px/390px widths. Check link spacing, wrapping, dark-theme contrast, and keyboard focus. Compare the login error/resend state with mockup A; confirm no horizontal overflow and no auth behavior changed.

- [x] **Step 5: Leave the changes uncommitted for local review**

Do not commit or push. Keep the existing local preview available for the user's review.
