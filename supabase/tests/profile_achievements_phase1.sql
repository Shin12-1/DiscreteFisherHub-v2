begin;
select plan(49);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'profile-public@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'profile-member@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'profile-private@example.test');

update public.profiles
set nickname = case id
      when '11111111-1111-4111-8111-111111111111' then 'Public Learner'
      when '22222222-2222-4222-8222-222222222222' then 'Member Learner'
      else 'Private Learner'
    end,
    profile_visibility = case id
      when '11111111-1111-4111-8111-111111111111' then 'public'
      when '22222222-2222-4222-8222-222222222222' then 'members'
      else 'private'
    end,
    study_time_visibility = case
      when id = '11111111-1111-4111-8111-111111111111' then 'private'
      else 'public'
    end,
    leaderboard_opt_in = (id = '11111111-1111-4111-8111-111111111111')
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

insert into public.profile_public_data (
  user_id, public_handle, nickname, title, level, member_since, profile_visibility
)
values
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'Public Learner', null, 1, now(), 'public'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'Member Learner', null, 1, now(), 'members'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'Private Learner', null, 1, now(), 'private');

insert into public.profile_section_projection (user_id, public_handle, section_key, visibility, section_data)
values
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'study_time', 'private', '{"totalSeconds": 1800}'),
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'fastest_times', 'members', '{"quiz":{"label":"Truth tables quiz","seconds":161,"score":5,"total":5}}'),
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'stats', 'public', '{}'),
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'badges', 'public', '{}'),
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'mastery', 'public', '[]'),
  ('11111111-1111-4111-8111-111111111111', 'public-learner-handle', 'activity', 'public', '[]'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'study_time', 'public', '{"totalSeconds": 1200}'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'fastest_times', 'public', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'stats', 'public', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'badges', 'public', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'mastery', 'public', '[]'),
  ('22222222-2222-4222-8222-222222222222', 'member-learner-handle', 'activity', 'public', '[]'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'study_time', 'public', '{"totalSeconds": 600}'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'fastest_times', 'public', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'stats', 'public', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'badges', 'public', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'mastery', 'public', '[]'),
  ('33333333-3333-4333-8333-333333333333', 'private-learner-handle', 'activity', 'public', '[]');

insert into public.leaderboard_projection (user_id, nickname, xp)
values ('11111111-1111-4111-8111-111111111111', 'Public Learner', 0);

insert into public.notifications (user_id, achievement_id, title, body)
values
  ('11111111-1111-4111-8111-111111111111', 'first-step', 'First Step unlocked', 'You opened your first lesson.'),
  ('22222222-2222-4222-8222-222222222222', 'warm-up', 'Warm Up unlocked', 'You studied for three days.');

insert into public.user_achievements (user_id, achievement_id)
values ('11111111-1111-4111-8111-111111111111', 'first-step');

select ok(
  not has_column_privilege('anon', 'public.profile_public_data', 'user_id', 'select'),
  'anon cannot select the internal auth user id'
);
select ok(
  not has_column_privilege('authenticated', 'public.profile_section_projection', 'user_id', 'select'),
  'authenticated cannot select the internal auth user id'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_achievements', 'insert,update,delete'),
  'authenticated cannot write achievement awards'
);
select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'insert,delete'),
  'authenticated cannot create or delete notifications'
);
select ok(
  has_column_privilege('authenticated', 'public.notifications', 'read_at', 'update'),
  'authenticated learners can mark their own notifications as read'
);
select ok(
  not has_column_privilege('authenticated', 'public.notifications', 'user_id', 'update'),
  'authenticated learners cannot change notification ownership'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon cannot query raw profiles'
);

set local role anon;
select results_eq(
  $$select nickname from public.profile_public_projection where public_handle = 'public-learner-handle'$$,
  array['Public Learner']::text[],
  'anon can read a public profile'
);
select is_empty(
  $$select nickname from public.profile_public_projection where public_handle in ('member-learner-handle', 'private-learner-handle')$$,
  'anon cannot read member-only or private profiles'
);
select results_eq(
  $$select study_time is null from public.profile_public_projection where public_handle = 'public-learner-handle'$$,
  array[true]::boolean[],
  'a hidden study-time section is null in the public projection'
);
select results_eq(
  $$select fastest_times is null from public.profile_public_projection where public_handle = 'public-learner-handle'$$,
  array[true]::boolean[],
  'a members-only section is null for anonymous visitors'
);
select results_eq(
  $$select nickname from public.leaderboard where nickname = 'Public Learner'$$,
  array['Public Learner']::text[],
  'anon can read opted-in leaderboard entries'
);
select is_empty(
  $$select nickname from public.leaderboard where nickname in ('Member Learner', 'Private Learner')$$,
  'default-opt-out profiles do not appear in the leaderboard'
);
select throws_ok(
  $$insert into public.notifications (user_id, title, body) values ('11111111-1111-4111-8111-111111111111', 'forged', 'forged')$$,
  '42501',
  null,
  'anon cannot create notifications'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select results_eq(
  $$select nickname from public.profile_public_projection where public_handle = 'member-learner-handle'$$,
  array['Member Learner']::text[],
  'a signed-in Hub account can read a members-only profile'
);
select results_eq(
  $$select fastest_times is null from public.profile_public_projection where public_handle = 'public-learner-handle'$$,
  array[false]::boolean[],
  'a signed-in Hub account can read a members-only section'
);
select is_empty(
  $$select nickname from public.profile_public_projection where public_handle = 'private-learner-handle'$$,
  'a signed-in non-owner cannot read a private profile'
);
select results_eq(
  $$select title from public.notifications$$,
  array['First Step unlocked']::text[],
  'a learner reads only their own notifications'
);
select results_eq(
  $$select achievement_id from public.user_achievements$$,
  array['first-step']::text[],
  'a learner reads only their own achievement awards'
);
select results_eq(
  $$select nickname from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  array['Public Learner']::text[],
  'a learner can read their own profile'
);
select results_eq(
  $$select nickname from public.profiles where id = '33333333-3333-4333-8333-333333333333'$$,
  array[]::text[],
  'a learner cannot read another profile directly'
);
select results_eq(
  $$update public.profiles set nickname = 'Updated Learner' where id = '11111111-1111-4111-8111-111111111111' returning nickname$$,
  array['Updated Learner']::text[],
  'a learner can update their own nickname'
);
select results_eq(
  $$update public.profiles set profile_visibility = 'members' where id = '11111111-1111-4111-8111-111111111111' returning profile_visibility$$,
  array['members']::text[],
  'a learner can update their own profile visibility'
);
select is_empty(
  $$update public.profiles set nickname = 'Hijacked Learner' where id = '22222222-2222-4222-8222-222222222222' returning nickname$$,
  'a learner cannot update another profile'
);
select throws_ok(
  $$insert into public.user_achievements (user_id, achievement_id) values ('11111111-1111-4111-8111-111111111111', 'explorer')$$,
  '42501',
  null,
  'a learner cannot insert an achievement award'
);
select throws_ok(
  $$insert into public.notifications (user_id, title, body) values ('11111111-1111-4111-8111-111111111111', 'forged', 'forged')$$,
  '42501',
  null,
  'a learner cannot insert a notification'
);
select ok(
  has_column_privilege('authenticated', 'public.profile_reports', 'reporter_id', 'insert'),
  'signed-in learners may create profile reports'
);
select lives_ok(
  $$insert into public.profile_reports (reporter_id, reported_id, reason) values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'other')$$,
  'a learner can create a report as themselves'
);
select lives_ok(
  $$insert into public.learning_events (user_id, client_event_id, event_type, event_data) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'nickname-changed', '{}')$$,
  'a learner fact can be recorded and evaluated by the database'
);
select results_eq(
  $$select achievement_id from public.user_achievements where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'name-tag'$$,
  array['name-tag']::text[],
  'the database awards an eligible nickname achievement'
);
select results_eq(
  $$select title from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'name-tag'$$,
  array['Name Tag unlocked']::text[],
  'a new award creates its notification'
);
select lives_ok(
  $$insert into public.learning_events (user_id, client_event_id, event_type, event_data) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'nickname-changed', '{}') on conflict (user_id, client_event_id) do nothing$$,
  'duplicate learner events are ignored'
);
select is(
  $$select count(*)::integer from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'name-tag'$$,
  1,
  'duplicate facts do not duplicate unlock notifications'
);
select results_eq(
  $$update public.notifications set read_at = now() where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'first-step' returning read_at is not null$$,
  array[true]::boolean[],
  'a learner can mark an owned notification read'
);
select is_empty(
  $$update public.notifications set read_at = now() where user_id = '22222222-2222-4222-8222-222222222222' returning id$$,
  'a learner cannot update another learner notification'
);
select lives_ok(
  $$insert into public.learning_events (user_id, client_event_id, event_type, event_data) select '11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'glossary-opened', '{}' from generate_series(1, 10)$$,
  'unavailable glossary activity can be recorded without granting a hidden feature'
);
select is_empty(
  $$select achievement_id from public.user_achievements where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'curious-mind'$$,
  'unavailable glossary achievements remain locked'
);
select lives_ok(
  $$insert into public.activity_completions (user_id, client_event_id, activity_type, activity_id, duration_seconds, score, total)
    values
      ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'lesson', 'logic-propositions', 60, null, null),
      ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'lesson', 'logic-truth-tables', 60, null, null),
      ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'lesson', 'logic-predicates', 60, null, null),
      ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'quiz', 'logic-propositions', 60, 5, 5),
      ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'quiz', 'logic-truth-tables', 60, 5, 5),
      ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'quiz', 'logic-predicates', 60, 5, 5)$$,
  'lesson and quiz facts are evaluated from the authenticated learner'
);
select lives_ok(
  $$insert into public.learning_events (user_id, client_event_id, event_type, event_data)
    select '11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'practice-question-answered', '{"correct":false,"tags":[]}' from generate_series(1, 20)
    union all
    select '11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'flashcard-reviewed',
      jsonb_build_object('deckId', 'logic', 'sessionId', 'weekly-test-session', 'cardId', 'weekly-card-' || card_number)
    from generate_series(1, 25) as cards(card_number)$$,
  'weekly practice and flashcard facts can be recorded'
);
select results_eq(
  $$select achievement_id from public.user_achievements where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'weekly-scholar' and period_key = to_char((timezone('Asia/Manila', now())::date - (extract(isodow from timezone('Asia/Manila', now()))::integer - 1)), 'IYYY-"W"IW')$$,
  array['weekly-scholar']::text[],
  'the current Manila weekly challenge awards one period-scoped badge'
);
select is(
  $$select count(*)::integer from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and achievement_id = 'weekly-scholar'$$,
  1,
  'weekly challenge retries retain a single notification per period'
);

reset role;
insert into public.profile_blocks (blocker_id, blocked_id)
values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select results_eq(
  $$select reason from public.profile_reports$$,
  array['other']::text[],
  'the reporter can read their own report'
);
select is_empty(
  $$select public_handle from public.profile_public_projection where public_handle = 'member-learner-handle'$$,
  'a block hides the other learner profile from the blocker'
);
select results_eq(
  $$select blocked_id::text from public.profile_blocks$$,
  array['22222222-2222-4222-8222-222222222222']::text[],
  'a blocker can read their own private block record'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is_empty(
  $$select reason from public.profile_reports$$,
  'another learner cannot read the reporter''s report'
);
select results_eq(
  $$select title from public.notifications$$,
  array['Warm Up unlocked']::text[],
  'another learner reads only their own notifications'
);
select is_empty(
  $$select public_handle from public.profile_public_projection where public_handle = 'public-learner-handle'$$,
  'a block hides the blocker profile from the blocked learner'
);
select is_empty(
  $$select * from public.profile_blocks$$,
  'a blocked learner cannot read the blocker''s private block record'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select results_eq(
  $$select nickname from public.profile_public_projection where public_handle = 'private-learner-handle'$$,
  array['Private Learner']::text[],
  'a learner can read their own private profile projection'
);

select * from finish();
rollback;
