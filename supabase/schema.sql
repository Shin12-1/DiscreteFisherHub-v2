-- DiscreteFisher Hub: user data only. Lesson content remains static JSON.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (nickname ~ '^[A-Za-z0-9 _.-]{3,32}$'),
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  streak integer not null default 0 check (streak >= 0),
  last_active date
);

create table public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 120),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null check (char_length(topic_id) between 1 and 120),
  mode text not null check (char_length(mode) between 1 and 40),
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  taken_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;

-- The client never grants itself profile statistics. Only nickname is writable.
revoke all on public.profiles, public.lesson_progress, public.quiz_attempts from anon, authenticated;
grant select, insert (id, nickname), update (nickname) on public.profiles to authenticated;
grant select, insert, delete on public.lesson_progress to authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant usage, select on sequence public.quiz_attempts_id_seq to authenticated;

create policy "profiles are private to their owner"
  on public.profiles for select to authenticated using (auth.uid() = id);
create policy "students can create only their profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "students can edit only their nickname"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "students read their lesson progress"
  on public.lesson_progress for select to authenticated using (auth.uid() = user_id);
create policy "students add their lesson progress"
  on public.lesson_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "students delete their lesson progress"
  on public.lesson_progress for delete to authenticated using (auth.uid() = user_id);

create policy "students read their quiz attempts"
  on public.quiz_attempts for select to authenticated using (auth.uid() = user_id);
create policy "students add their quiz attempts"
  on public.quiz_attempts for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), 'student-' || left(new.id::text, 8))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- XP derives only from distinct completed lesson rows (50 XP each).
-- Quiz attempts are retained for future feedback but do not award client-controlled XP.
create or replace function public.refresh_profile_from_progress(target_user uuid, touch_activity boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  completed_count integer;
begin
  select count(*) into completed_count from public.lesson_progress where user_id = target_user;
  update public.profiles
  set xp = completed_count * 50,
      level = floor((completed_count * 50)::numeric / 150)::integer + 1,
      streak = case
        when not touch_activity then streak
        when last_active = current_date then streak
        when last_active = current_date - 1 then streak + 1
        else 1
      end,
      last_active = case when touch_activity then current_date else last_active end
  where id = target_user;
end;
$$;

create or replace function public.on_lesson_progress_changed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.refresh_profile_from_progress(coalesce(new.user_id, old.user_id), tg_op <> 'DELETE');
  return coalesce(new, old);
end;
$$;

create trigger lesson_progress_refreshes_profile
  after insert or delete on public.lesson_progress
  for each row execute procedure public.on_lesson_progress_changed();

create or replace function public.on_quiz_attempt_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.refresh_profile_from_progress(new.user_id, false);
  return new;
end;
$$;

create trigger quiz_attempt_refreshes_profile
  after insert on public.quiz_attempts
  for each row execute procedure public.on_quiz_attempt_created();

revoke all on function public.handle_new_user() from public;
revoke all on function public.refresh_profile_from_progress(uuid, boolean) from public;
revoke all on function public.on_lesson_progress_changed() from public;
revoke all on function public.on_quiz_attempt_created() from public;

-- This view intentionally exposes only leaderboard-safe fields, never email or user id.
create view public.leaderboard as
  select nickname, xp
  from public.profiles
  order by xp desc, nickname asc
  limit 50;

revoke all on public.leaderboard from public;
grant select on public.leaderboard to anon, authenticated;

alter table public.profiles
  add column if not exists public_handle text,
  add column if not exists joined_at timestamptz,
  add column if not exists profile_visibility text not null default 'private'
    check (profile_visibility in ('private', 'members', 'public')),
  add column if not exists search_opt_in boolean not null default false,
  add column if not exists study_time_visibility text not null default 'private'
    check (study_time_visibility in ('private', 'members', 'public')),
  add column if not exists fastest_times_visibility text not null default 'private'
    check (fastest_times_visibility in ('private', 'members', 'public')),
  add column if not exists stats_visibility text not null default 'private'
    check (stats_visibility in ('private', 'members', 'public')),
  add column if not exists badges_visibility text not null default 'private'
    check (badges_visibility in ('private', 'members', 'public')),
  add column if not exists mastery_visibility text not null default 'private'
    check (mastery_visibility in ('private', 'members', 'public')),
  add column if not exists activity_visibility text not null default 'private'
    check (activity_visibility in ('private', 'members', 'public')),
  add column if not exists leaderboard_opt_in boolean not null default false,
  add column if not exists selected_title text;

update public.profiles as p
set public_handle = replace(gen_random_uuid()::text, '-', '')
where p.public_handle is null;

update public.profiles as p
set joined_at = coalesce(u.created_at, now())
from auth.users as u
where u.id = p.id and p.joined_at is null;

alter table public.profiles
  alter column public_handle set default replace(gen_random_uuid()::text, '-', ''),
  alter column public_handle set not null,
  alter column joined_at set default now(),
  alter column joined_at set not null;

create unique index if not exists profiles_public_handle_key on public.profiles (public_handle);

revoke update (nickname) on public.profiles from authenticated;
grant update (
  nickname,
  profile_visibility,
  search_opt_in,
  study_time_visibility,
  fastest_times_visibility,
  stats_visibility,
  badges_visibility,
  mastery_visibility,
  activity_visibility,
  leaderboard_opt_in
) on public.profiles to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_session_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0
    check (duration_seconds between 0 and 14400),
  unique (user_id, client_session_id),
  check (ended_at is null or ended_at >= started_at)
);

create table public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_event_id uuid not null,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  activity_type text not null check (activity_type in ('lesson', 'quiz', 'checkpoint')),
  activity_id text not null check (char_length(activity_id) between 1 and 120),
  duration_seconds integer not null default 0
    check (duration_seconds between 0 and 14400),
  score integer,
  total integer,
  completed_at timestamptz not null default now(),
  unique (user_id, client_event_id),
  check (
    (score is null and total is null) or
    (score is not null and total is not null and score >= 0 and total > 0 and score <= total)
  )
);

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_event_id uuid not null,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_-]{0,79}$'),
  event_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_data) = 'object'),
  occurred_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create table public.achievement_catalog (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null,
  category text not null,
  rule_key text not null,
  criteria jsonb not null check (jsonb_typeof(criteria) = 'object'),
  hidden boolean not null default false,
  available boolean not null default true,
  reward_title text
);

create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievement_catalog(id),
  period_key text not null default '',
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id, period_key),
  check (
    period_key = '' or
    period_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievement_catalog(id),
  period_key text not null default '',
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, achievement_id, period_key),
  check (
    period_key = '' or
    period_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'
  )
);

create table public.profile_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create table public.profile_public_data (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_handle text not null unique,
  nickname text not null,
  title text,
  level integer not null check (level >= 1),
  member_since timestamptz not null,
  profile_visibility text not null
    check (profile_visibility in ('private', 'members', 'public')),
  unique (user_id, public_handle)
);

create table public.profile_section_projection (
  user_id uuid not null,
  public_handle text not null,
  section_key text not null
    check (section_key in ('study_time', 'fastest_times', 'stats', 'badges', 'mastery', 'activity')),
  visibility text not null check (visibility in ('private', 'members', 'public')),
  section_data jsonb not null check (jsonb_typeof(section_data) in ('object', 'array')),
  primary key (user_id, section_key),
  foreign key (user_id, public_handle)
    references public.profile_public_data(user_id, public_handle) on delete cascade
);

create table public.leaderboard_projection (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  nickname text not null,
  xp integer not null check (xp >= 0),
  refreshed_at timestamptz not null default now()
);

insert into public.achievement_catalog
  (id, title, description, category, rule_key, criteria, hidden, available, reward_title)
values
  ('first-step', 'First Step', 'Open your first lesson.', 'Getting started', 'event-count', '{"event":"lesson-opened","target":1}', false, true, null),
  ('name-tag', 'Name Tag', 'Set a nickname for your profile.', 'Getting started', 'event-count', '{"event":"nickname-changed","target":1}', false, true, null),
  ('explorer', 'Explorer', 'Visit every page in the sidebar.', 'Getting started', 'all-sidebar-pages', '{"pages":["dashboard","courses","lessons","flashcards","practice","quizzes","assessments","progress","profile"]}', false, true, null),
  ('logic-rookie', 'Logic Rookie', 'Complete the Propositions and Connectives lesson.', 'Lessons', 'lesson-completed', '{"lessonId":"logic-propositions"}', false, true, 'Logic Apprentice'),
  ('table-builder', 'Table Builder', 'Complete the Truth Tables and Equivalences lesson.', 'Lessons', 'lesson-completed', '{"lessonId":"logic-truth-tables"}', false, true, null),
  ('course-complete', 'Course Complete', 'Complete every published lesson in the Logic topic.', 'Lessons', 'topic-completed', '{"topicId":"logic"}', false, true, 'Proof Master'),
  ('warm-up', 'Warm Up', 'Study on 3 consecutive Manila calendar days.', 'Streaks', 'streak-days', '{"days":3}', false, true, null),
  ('on-fire', 'On Fire', 'Study on 7 consecutive Manila calendar days.', 'Streaks', 'streak-days', '{"days":7}', false, true, null),
  ('unstoppable', 'Unstoppable', 'Study on 30 consecutive Manila calendar days.', 'Streaks', 'streak-days', '{"days":30}', false, true, null),
  ('perfect-score', 'Perfect Score', 'Earn 5 out of 5 on a quiz.', 'Quizzes and practice', 'perfect-quiz-score', '{"score":5,"total":5}', false, true, null),
  ('comeback', 'Comeback', 'Improve a previous score on the same quiz.', 'Quizzes and practice', 'quiz-score-improved', '{}', false, true, null),
  ('sharp-mind', 'Sharp Mind', 'Score at least 80% on 3 consecutive quiz attempts.', 'Quizzes and practice', 'consecutive-quiz-threshold', '{"attempts":3,"minPercent":80}', false, true, null),
  ('practice-makes-perfect', 'Practice Makes Perfect', 'Submit 50 practice-question answers.', 'Quizzes and practice', 'practice-answers', '{"count":50}', false, true, null),
  ('memory-workout', 'Memory Workout', 'Review every card in one deck during a study session.', 'Flashcards', 'deck-reviewed', '{}', false, true, null),
  ('card-shark', 'Card Shark', 'Review 100 cards, counting each card at most once per session.', 'Flashcards', 'cards-reviewed', '{"count":100}', false, true, null),
  ('checkpoint-cleared', 'Checkpoint Cleared', 'Complete a checkpoint.', 'Assessments', 'checkpoint-completed', '{}', false, true, null),
  ('growth', 'Growth', 'Beat your previous score on the same checkpoint.', 'Assessments', 'checkpoint-score-improved', '{}', false, true, null),
  ('night-owl', 'Night Owl', 'Study between 10:00 PM and midnight Manila time.', 'Fun and hidden', 'study-local-hour', '{"startHour":22,"endHourExclusive":24,"timeZone":"Asia/Manila"}', false, true, null),
  ('early-bird', 'Early Bird', 'Study before 7:00 AM Manila time.', 'Fun and hidden', 'study-local-hour', '{"startHour":0,"endHourExclusive":7,"timeZone":"Asia/Manila"}', false, true, null),
  ('de-morgans-disciple', 'De Morgan''s Disciple', 'Answer 5 De Morgan questions correctly.', 'Fun and hidden', 'de-morgan-correct', '{"count":5}', false, true, null),
  ('curious-mind', 'Curious Mind', 'Open the glossary 10 times.', 'Fun and hidden', 'glossary-opens', '{"count":10}', false, false, null),
  ('secret', 'Secret', 'Earn a perfect score on every published Logic quiz.', 'Fun and hidden', 'perfect-every-published-quiz', '{"topicId":"logic"}', true, true, null),
  ('weekly-scholar', 'Weekly Scholar', 'Completed this week''s study challenge.', 'Weekly challenges', 'weekly-challenge', '{}', false, true, null)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rule_key = excluded.rule_key,
  criteria = excluded.criteria,
  hidden = excluded.hidden,
  available = excluded.available,
  reward_title = excluded.reward_title;

create index study_sessions_user_started_idx
  on public.study_sessions (user_id, started_at desc);
create index activity_completions_user_completed_idx
  on public.activity_completions (user_id, completed_at desc);
create index activity_completions_study_session_idx
  on public.activity_completions (study_session_id);
create index learning_events_user_occurred_idx
  on public.learning_events (user_id, occurred_at desc);
create index learning_events_study_session_idx
  on public.learning_events (study_session_id);
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_achievement_idx
  on public.notifications (achievement_id);
create index user_achievements_achievement_idx
  on public.user_achievements (achievement_id);
create index profile_blocks_blocked_blocker_idx
  on public.profile_blocks (blocked_id, blocker_id);
create index profile_reports_reporter_created_idx
  on public.profile_reports (reporter_id, created_at desc);
create index profile_reports_reported_created_idx
  on public.profile_reports (reported_id, created_at desc);
create unique index profile_section_projection_handle_key
  on public.profile_section_projection (public_handle, section_key);
create index profile_section_projection_user_handle_idx
  on public.profile_section_projection (user_id, public_handle);
create index leaderboard_projection_opted_xp_idx
  on public.leaderboard_projection (xp desc, nickname asc);

alter table public.study_sessions enable row level security;
alter table public.activity_completions enable row level security;
alter table public.learning_events enable row level security;
alter table public.achievement_catalog enable row level security;
alter table public.user_achievements enable row level security;
alter table public.notifications enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.profile_reports enable row level security;
alter table public.profile_public_data enable row level security;
alter table public.profile_section_projection enable row level security;
alter table public.leaderboard_projection enable row level security;

revoke all on public.study_sessions, public.activity_completions, public.learning_events,
  public.achievement_catalog, public.user_achievements, public.notifications,
  public.profile_blocks, public.profile_reports, public.profile_public_data,
  public.profile_section_projection, public.leaderboard_projection
from PUBLIC, anon, authenticated;

grant select on public.study_sessions to authenticated;
grant insert (
  user_id, client_session_id, started_at
) on public.study_sessions to authenticated;
grant update (
  ended_at, duration_seconds
) on public.study_sessions to authenticated;
grant select, insert (
  user_id, client_event_id, study_session_id, activity_type, activity_id, duration_seconds, score, total
) on public.activity_completions to authenticated;
grant select, insert (
  user_id, client_event_id, study_session_id, event_type, event_data
) on public.learning_events to authenticated;
grant select on public.user_achievements to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, delete on public.profile_blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.profile_blocks to authenticated;
grant select on public.profile_reports to authenticated;
grant insert (reporter_id, reported_id, reason, details) on public.profile_reports to authenticated;
grant select (public_handle, nickname, title, level, member_since)
  on public.profile_public_data to anon, authenticated;
grant select (public_handle, section_key, section_data)
  on public.profile_section_projection to anon, authenticated;
grant select (nickname, xp) on public.leaderboard_projection to anon, authenticated;

create policy study_sessions_owner_select
  on public.study_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy study_sessions_owner_insert
  on public.study_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy study_sessions_owner_update
  on public.study_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy activity_completions_owner_select
  on public.activity_completions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy activity_completions_owner_insert
  on public.activity_completions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy learning_events_owner_select
  on public.learning_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy learning_events_owner_insert
  on public.learning_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_achievements_owner_select
  on public.user_achievements for select to authenticated
  using ((select auth.uid()) = user_id);

create policy notifications_owner_select
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notifications_owner_update
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profile_blocks_owner_select
  on public.profile_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy profile_blocks_owner_insert
  on public.profile_blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id);
create policy profile_blocks_owner_delete
  on public.profile_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

create policy profile_reports_reporter_select
  on public.profile_reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
create policy profile_reports_reporter_insert
  on public.profile_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy leaderboard_opted_in_select
  on public.leaderboard_projection for select to anon, authenticated
  using (true);

create or replace function private.can_view_profile(target_user uuid, target_visibility text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if target_user is null then
    return false;
  end if;
  if viewer_id = target_user then
    return true;
  end if;
  if target_visibility not in ('members', 'public') then
    return false;
  end if;
  if viewer_id is null then
    return target_visibility = 'public';
  end if;
  return not exists (
    select 1
    from public.profile_blocks as b
    where (b.blocker_id = viewer_id and b.blocked_id = target_user)
       or (b.blocker_id = target_user and b.blocked_id = viewer_id)
  );
end;
$$;

create or replace function private.can_view_profile_section(target_user uuid, section_visibility text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  target_profile_visibility text;
begin
  select d.profile_visibility
  into target_profile_visibility
  from public.profile_public_data as d
  where d.user_id = target_user;
  if not found or not private.can_view_profile(target_user, target_profile_visibility) then
    return false;
  end if;
  if viewer_id = target_user then
    return true;
  end if;
  if section_visibility = 'private' then
    return false;
  end if;
  if viewer_id is null then
    return section_visibility = 'public';
  end if;
  return section_visibility in ('members', 'public');
end;
$$;

grant execute on function private.can_view_profile(uuid, text) to anon, authenticated;
grant execute on function private.can_view_profile_section(uuid, text) to anon, authenticated;
revoke all on function private.can_view_profile(uuid, text) from public;
revoke all on function private.can_view_profile_section(uuid, text) from public;

create policy profile_public_data_visible
  on public.profile_public_data for select to anon, authenticated
  using (private.can_view_profile(user_id, profile_visibility));
create policy profile_section_visible
  on public.profile_section_projection for select to anon, authenticated
  using (private.can_view_profile_section(user_id, visibility));

create or replace function private.award_achievement(
  target_user uuid,
  target_achievement text,
  target_period text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_rule text;
  target_title text;
  target_description text;
  inserted_user uuid;
begin
  if target_user is null then
    raise exception 'An award owner is required.' using errcode = '22023';
  end if;
  if target_period is null then
    raise exception 'An award period is required.' using errcode = '22023';
  end if;
  if (select auth.uid()) is not null and (select auth.uid()) <> target_user then
    raise exception 'Cannot award an achievement to another learner.' using errcode = '42501';
  end if;

  select c.rule_key, c.title, c.description
  into target_rule, target_title, target_description
  from public.achievement_catalog as c
  where c.id = target_achievement and c.available;
  if not found then
    return false;
  end if;
  if target_rule = 'weekly-challenge' then
    if target_period !~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' then
      raise exception 'A valid Manila ISO week is required.' using errcode = '22023';
    end if;
  elsif target_period <> '' then
    raise exception 'One-time achievements must use an empty period.' using errcode = '22023';
  end if;

  insert into public.user_achievements (user_id, achievement_id, period_key)
  values (target_user, target_achievement, target_period)
  on conflict (user_id, achievement_id, period_key) do nothing
  returning user_id into inserted_user;
  if inserted_user is null then
    return false;
  end if;

  insert into public.notifications (user_id, achievement_id, period_key, title, body)
  values (
    target_user,
    target_achievement,
    target_period,
    target_title || ' unlocked',
    target_description
  )
  on conflict (user_id, achievement_id, period_key) do nothing;
  return true;
end;
$$;

revoke all on function private.award_achievement(uuid, text, text) from public, anon, authenticated;

create or replace function private.evaluate_achievements_for_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_day date;
  previous_day date;
  current_streak integer := 0;
  longest_streak integer := 0;
  week_now timestamp;
  week_start date;
  week_end date;
  week_key text;
  challenge_index integer;
  fact_count bigint;
  quiz_attempt_count integer;
  all_quizzes_above_threshold boolean;
begin
  if target_user is null then
    raise exception 'An award owner is required.' using errcode = '22023';
  end if;
  if (select auth.uid()) is not null and (select auth.uid()) <> target_user then
    raise exception 'Cannot evaluate another learner.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.learning_events
    where user_id = target_user and event_type = 'lesson-opened'
  ) then
    perform private.award_achievement(target_user, 'first-step', '');
  end if;
  if exists (
    select 1 from public.learning_events
    where user_id = target_user and event_type = 'nickname-changed'
  ) then
    perform private.award_achievement(target_user, 'name-tag', '');
  end if;
  select count(distinct event_data ->> 'page') into fact_count
  from public.learning_events
  where user_id = target_user
    and event_type = 'page-visited'
    and event_data ->> 'page' in (
      'dashboard', 'courses', 'lessons', 'flashcards', 'practice',
      'quizzes', 'assessments', 'progress', 'profile'
    );
  if fact_count = 9 then
    perform private.award_achievement(target_user, 'explorer', '');
  end if;

  if exists (
    select 1 from public.activity_completions
    where user_id = target_user and activity_type = 'lesson' and activity_id = 'logic-propositions'
  ) then
    perform private.award_achievement(target_user, 'logic-rookie', '');
  end if;
  if exists (
    select 1 from public.activity_completions
    where user_id = target_user and activity_type = 'lesson' and activity_id = 'logic-truth-tables'
  ) then
    perform private.award_achievement(target_user, 'table-builder', '');
  end if;
  if (
    select count(distinct activity_id) from public.activity_completions
    where user_id = target_user
      and activity_type = 'lesson'
      and activity_id in ('logic-propositions', 'logic-truth-tables', 'logic-predicates')
  ) = 3 then
    perform private.award_achievement(target_user, 'course-complete', '');
  end if;

  for current_day in
    select distinct (started_at at time zone 'Asia/Manila')::date
    from public.study_sessions
    where user_id = target_user and duration_seconds > 0
    order by 1
  loop
    if previous_day is not null and current_day = previous_day + 1 then
      current_streak := current_streak + 1;
    else
      current_streak := 1;
    end if;
    longest_streak := greatest(longest_streak, current_streak);
    previous_day := current_day;
  end loop;
  if longest_streak >= 3 then perform private.award_achievement(target_user, 'warm-up', ''); end if;
  if longest_streak >= 7 then perform private.award_achievement(target_user, 'on-fire', ''); end if;
  if longest_streak >= 30 then perform private.award_achievement(target_user, 'unstoppable', ''); end if;

  if exists (
    select 1 from public.activity_completions
    where user_id = target_user and activity_type = 'quiz' and score = 5 and total = 5
  ) then
    perform private.award_achievement(target_user, 'perfect-score', '');
  end if;
  if exists (
    select 1
    from public.activity_completions as newer
    join public.activity_completions as older
      on older.user_id = newer.user_id
     and older.activity_type = 'quiz'
     and older.activity_id = newer.activity_id
     and (newer.completed_at, newer.id) > (older.completed_at, older.id)
    where newer.user_id = target_user
      and newer.activity_type = 'quiz'
      and newer.total > 0
      and older.total > 0
      and newer.score::numeric / newer.total > older.score::numeric / older.total
  ) then
    perform private.award_achievement(target_user, 'comeback', '');
  end if;
  select count(*), coalesce(bool_and(score::numeric / total >= 0.8), false)
  into quiz_attempt_count, all_quizzes_above_threshold
  from (
    select score, total
    from public.activity_completions
    where user_id = target_user and activity_type = 'quiz' and total > 0
    order by completed_at desc, id desc
    limit 3
  ) as recent_quizzes;
  if quiz_attempt_count = 3 and all_quizzes_above_threshold then
    perform private.award_achievement(target_user, 'sharp-mind', '');
  end if;

  select count(*) into fact_count
  from public.learning_events
  where user_id = target_user and event_type = 'practice-question-answered';
  if fact_count >= 50 then
    perform private.award_achievement(target_user, 'practice-makes-perfect', '');
  end if;
  if exists (
    select 1
    from public.learning_events
    where user_id = target_user
      and event_type = 'flashcard-reviewed'
      and event_data ->> 'deckId' = 'logic'
      and event_data ->> 'sessionId' is not null
      and event_data ->> 'cardId' is not null
    group by event_data ->> 'sessionId'
    having count(distinct event_data ->> 'cardId') >= 15
  ) then
    perform private.award_achievement(target_user, 'memory-workout', '');
  end if;
  select count(*) into fact_count
  from (
    select distinct event_data ->> 'sessionId', event_data ->> 'cardId'
    from public.learning_events
    where user_id = target_user
      and event_type = 'flashcard-reviewed'
      and event_data ->> 'sessionId' is not null
      and event_data ->> 'cardId' is not null
  ) as reviewed_cards;
  if fact_count >= 100 then
    perform private.award_achievement(target_user, 'card-shark', '');
  end if;

  if exists (
    select 1 from public.activity_completions
    where user_id = target_user and activity_type = 'checkpoint'
  ) then
    perform private.award_achievement(target_user, 'checkpoint-cleared', '');
  end if;
  if exists (
    select 1
    from public.activity_completions as newer
    join public.activity_completions as older
      on older.user_id = newer.user_id
     and older.activity_type = 'checkpoint'
     and older.activity_id = newer.activity_id
     and (newer.completed_at, newer.id) > (older.completed_at, older.id)
    where newer.user_id = target_user
      and newer.activity_type = 'checkpoint'
      and newer.total > 0
      and older.total > 0
      and newer.score::numeric / newer.total > older.score::numeric / older.total
  ) then
    perform private.award_achievement(target_user, 'growth', '');
  end if;
  if exists (
    select 1 from public.study_sessions
    where user_id = target_user
      and duration_seconds > 0
      and extract(hour from started_at at time zone 'Asia/Manila') >= 22
  ) then
    perform private.award_achievement(target_user, 'night-owl', '');
  end if;
  if exists (
    select 1 from public.study_sessions
    where user_id = target_user
      and duration_seconds > 0
      and extract(hour from started_at at time zone 'Asia/Manila') < 7
  ) then
    perform private.award_achievement(target_user, 'early-bird', '');
  end if;
  select count(*) into fact_count
  from public.learning_events
  where user_id = target_user
    and event_type = 'practice-question-answered'
    and event_data ->> 'correct' = 'true'
    and coalesce(event_data -> 'tags', '[]'::jsonb) ? 'de-morgan';
  if fact_count >= 5 then
    perform private.award_achievement(target_user, 'de-morgans-disciple', '');
  end if;
  if (
    select count(distinct activity_id) from public.activity_completions
    where user_id = target_user
      and activity_type = 'quiz'
      and activity_id in ('logic-propositions', 'logic-truth-tables', 'logic-predicates')
      and score = total
      and total > 0
  ) = 3 then
    perform private.award_achievement(target_user, 'secret', '');
  end if;

  week_now := timezone('Asia/Manila', now());
  week_start := week_now::date - (extract(isodow from week_now)::integer - 1);
  week_end := week_start + 7;
  week_key := to_char(week_start, 'IYYY-"W"IW');
  challenge_index := mod((week_start - date '1970-01-05') / 7, 4);
  if challenge_index = 0 then
    select count(*) into fact_count
    from public.activity_completions
    where user_id = target_user and activity_type = 'lesson'
      and (completed_at at time zone 'Asia/Manila')::date >= week_start
      and (completed_at at time zone 'Asia/Manila')::date < week_end;
  elsif challenge_index = 1 then
    select count(*) into fact_count
    from public.activity_completions
    where user_id = target_user and activity_type = 'quiz'
      and (completed_at at time zone 'Asia/Manila')::date >= week_start
      and (completed_at at time zone 'Asia/Manila')::date < week_end;
  elsif challenge_index = 2 then
    select count(*) into fact_count
    from public.learning_events
    where user_id = target_user and event_type = 'practice-question-answered'
      and (occurred_at at time zone 'Asia/Manila')::date >= week_start
      and (occurred_at at time zone 'Asia/Manila')::date < week_end;
  else
    select count(*) into fact_count
    from (
      select distinct event_data ->> 'sessionId', event_data ->> 'cardId'
      from public.learning_events
      where user_id = target_user
        and event_type = 'flashcard-reviewed'
        and event_data ->> 'sessionId' is not null
        and event_data ->> 'cardId' is not null
        and (occurred_at at time zone 'Asia/Manila')::date >= week_start
        and (occurred_at at time zone 'Asia/Manila')::date < week_end
    ) as weekly_cards;
  end if;
  if fact_count >= case challenge_index when 0 then 3 when 1 then 3 when 2 then 20 else 25 end then
    perform private.award_achievement(target_user, 'weekly-scholar', week_key);
  end if;
end;
$$;

create or replace function private.on_learner_fact_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'study_sessions' then
    if new.duration_seconds <= 0 then return new; end if;
    if tg_op = 'UPDATE' then
      if old.duration_seconds > 0 then return new; end if;
    end if;
  end if;
  perform private.evaluate_achievements_for_user(new.user_id);
  return new;
end;
$$;

create trigger learning_events_evaluate_achievements
  after insert on public.learning_events
  for each row execute function private.on_learner_fact_changed();
create trigger activity_completions_evaluate_achievements
  after insert on public.activity_completions
  for each row execute function private.on_learner_fact_changed();
create trigger study_sessions_evaluate_achievements
  after insert or update of duration_seconds on public.study_sessions
  for each row execute function private.on_learner_fact_changed();

revoke all on function private.evaluate_achievements_for_user(uuid) from public, anon, authenticated;
revoke all on function private.on_learner_fact_changed() from public, anon, authenticated;

create or replace view public.profile_public_projection
with (security_invoker = true)
as
select
  d.public_handle,
  d.nickname,
  d.title,
  d.level,
  d.member_since,
  (select s.section_data from public.profile_section_projection as s
   where s.public_handle = d.public_handle and s.section_key = 'study_time') as study_time,
  (select s.section_data from public.profile_section_projection as s
   where s.public_handle = d.public_handle and s.section_key = 'fastest_times') as fastest_times,
  (select s.section_data from public.profile_section_projection as s
   where s.public_handle = d.public_handle and s.section_key = 'stats') as stats,
  (select s.section_data from public.profile_section_projection as s
   where s.public_handle = d.public_handle and s.section_key = 'badges') as badges,
  (select s.section_data from public.profile_section_projection as s
   where s.public_handle = d.public_handle and s.section_key = 'mastery') as mastery,
  (select s.section_data from public.profile_section_projection as s
   where s.public_handle = d.public_handle and s.section_key = 'activity') as activity
from public.profile_public_data as d;

revoke all on public.profile_public_projection from public, anon, authenticated;
grant select on public.profile_public_projection to anon, authenticated;

create or replace view public.leaderboard
with (security_invoker = true)
as
select nickname, xp
from public.leaderboard_projection
order by xp desc, nickname asc
limit 50;

revoke all on public.leaderboard from public, anon, authenticated;
grant select on public.leaderboard to anon, authenticated;