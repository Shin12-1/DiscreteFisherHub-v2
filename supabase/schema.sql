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

