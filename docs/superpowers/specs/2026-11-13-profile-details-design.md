# Profile details design

## Intent

Implement the expanded Profile from the latest concept using the profile arrangement in `learning-hub-renovation.html`. Keep Dashboard, Courses, Lessons, Flashcards, Practice, Quizzes, Assessments, and Progress matching the user's attached navy-and-yellow screenshot.

## Approach

Keep the existing nickname, authenticated email, sign-in/sync, change-email, reauthentication, and logout behavior. Add optional program and year-level fields, weekly study goal, session length, preferred time, lesson preference, reminder preferences, and reduced-motion preference. Store these preferences in a separate local-only key for guest and signed-in users; never send them to Supabase. The existing theme setting remains local. Keep email read-only and use the existing account flow for email changes. Program and year start unset rather than assuming a student's details.

Implementation defaults: 3 study sessions per week, 25 minutes per session, flexible study time, worked examples first, and reminders/reduced motion off. These are editable preferences, not claims about the student's habits.

Use the older prototype's profile composition: compact learner summary, adjacent details form, and a separate account/privacy section. Keep the production FVC shell and navy/yellow design tokens. Reminder selections are saved as preferences; notification delivery is out of scope and must not be implied. Remove the rejected `learning-hub-renovation-v2.html` and `learning-hub-field-notes.html` previews, but retain the referenced `learning-hub-renovation.html` as the design reference.

## Alternatives

- Sync preferences to Supabase: not chosen; it requires a database/schema change and the user chose local-only storage.
- Add only a visual profile mockup: not chosen; the user asked to implement the profile details.

## Non-goals

Do not redesign the other eight pages, change the FVC brand or published course availability, add notification delivery, or change authentication and account email handling.
