alter table public.profiles
  add column if not exists pinned_badge_ids text[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_pinned_badge_ids_max,
  add constraint profiles_pinned_badge_ids_max
    check (cardinality(pinned_badge_ids) <= 3);

alter table public.profile_reports
  drop constraint if exists profile_reports_reason_check,
  add constraint profile_reports_reason_check
    check (reason in ('privacy', 'impersonation', 'harassment', 'other'));

create or replace function public.load_public_profile(target_handle text, visitor_preview boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles%rowtype;
  viewer_id uuid := (select auth.uid());
  profile_visible boolean;
  owner_view boolean;
  show_study_time boolean;
  show_fastest_times boolean;
  show_stats boolean;
  show_badges boolean;
  show_mastery boolean;
  show_activity boolean;
  week_start timestamptz;
  month_start timestamptz;
  total_seconds bigint;
  week_seconds bigint;
  month_seconds bigint;
  fastest_items jsonb;
  stats_data jsonb;
  badges_data jsonb;
  mastery_data jsonb;
  activity_data jsonb;
begin
  if target_handle is null or char_length(target_handle) > 80 then
    return null;
  end if;

  select p.* into profile_row
  from public.profiles as p
  where p.public_handle = target_handle;
  if not found then
    return null;
  end if;

  if visitor_preview then
    profile_visible := viewer_id = profile_row.id
      and profile_row.profile_visibility = 'public';
  else
    profile_visible := private.can_view_profile(profile_row.id, profile_row.profile_visibility);
  end if;
  if not profile_visible then
    return null;
  end if;

  owner_view := viewer_id = profile_row.id and not visitor_preview;
  show_study_time := owner_view or profile_row.study_time_visibility = 'public'
    or (profile_row.study_time_visibility = 'members' and viewer_id is not null and not visitor_preview);
  show_fastest_times := owner_view or profile_row.fastest_times_visibility = 'public'
    or (profile_row.fastest_times_visibility = 'members' and viewer_id is not null and not visitor_preview);
  show_stats := owner_view or profile_row.stats_visibility = 'public'
    or (profile_row.stats_visibility = 'members' and viewer_id is not null and not visitor_preview);
  show_badges := owner_view or profile_row.badges_visibility = 'public'
    or (profile_row.badges_visibility = 'members' and viewer_id is not null and not visitor_preview);
  show_mastery := owner_view or profile_row.mastery_visibility = 'public'
    or (profile_row.mastery_visibility = 'members' and viewer_id is not null and not visitor_preview);
  show_activity := owner_view or profile_row.activity_visibility = 'public'
    or (profile_row.activity_visibility = 'members' and viewer_id is not null and not visitor_preview);

  week_start := date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  month_start := (((now() at time zone 'Asia/Manila')::date - 29)::timestamp at time zone 'Asia/Manila');

  select coalesce(sum(s.duration_seconds), 0)
  into total_seconds
  from public.study_sessions as s
  where s.user_id = profile_row.id and s.started_at >= profile_row.joined_at;

  select coalesce(sum(s.duration_seconds), 0)
  into week_seconds
  from public.study_sessions as s
  where s.user_id = profile_row.id
    and s.started_at >= week_start and s.started_at < week_start + interval '7 days';

  select coalesce(sum(s.duration_seconds), 0)
  into month_seconds
  from public.study_sessions as s
  where s.user_id = profile_row.id and s.started_at >= month_start and s.started_at <= now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', fastest.activity_type,
    'activityId', fastest.activity_id,
    'durationSeconds', fastest.duration_seconds,
    'score', fastest.score,
    'total', fastest.total
  ) order by fastest.activity_type, fastest.activity_id), '[]'::jsonb)
  into fastest_items
  from (
    select distinct on (c.activity_type, c.activity_id)
      c.activity_type, c.activity_id, c.duration_seconds, c.score, c.total
    from public.activity_completions as c
    where c.user_id = profile_row.id and c.duration_seconds > 0
    order by c.activity_type, c.activity_id, c.duration_seconds, c.completed_at, c.id
  ) as fastest;

  stats_data := jsonb_build_object(
    'xp', profile_row.xp,
    'streak', profile_row.streak,
    'lessonsCompleted', (
      select count(distinct c.activity_id)
      from public.activity_completions as c
      where c.user_id = profile_row.id and c.activity_type = 'lesson'
    ),
    'quizzesTaken', (
      select count(*)
      from public.activity_completions as c
      where c.user_id = profile_row.id and c.activity_type = 'quiz'
    )
  );

  select jsonb_build_object(
    'pinned', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pinned.id,
        'title', pinned.title,
        'unlockedAt', pinned.unlocked_at
      ) order by pinned.unlocked_at desc)
      from (
        select distinct on (a.id) a.id, a.title, ua.unlocked_at
        from public.user_achievements as ua
        join public.achievement_catalog as a on a.id = ua.achievement_id
        where ua.user_id = profile_row.id
          and a.id = any(profile_row.pinned_badge_ids)
        order by a.id, ua.unlocked_at desc
      ) as pinned
    ), '[]'::jsonb),
    'earnedCount', (
      select count(*)
      from public.user_achievements as ua
      where ua.user_id = profile_row.id
    )
  ) into badges_data;

  select jsonb_build_object(
    'completedLessonIds',
    coalesce(jsonb_agg(distinct c.activity_id order by c.activity_id), '[]'::jsonb)
  )
  into mastery_data
  from public.activity_completions as c
  where c.user_id = profile_row.id and c.activity_type = 'lesson';

  with milestones as (
    select
      'lesson-completed'::text as event_type,
      c.activity_id,
      null::text as label,
      c.completed_at as occurred_at
    from public.activity_completions as c
    where c.user_id = profile_row.id and c.activity_type = 'lesson'
    union all
    select
      'checkpoint-completed',
      c.activity_id,
      'Finished a checkpoint',
      c.completed_at
    from public.activity_completions as c
    where c.user_id = profile_row.id and c.activity_type = 'checkpoint'
    union all
    select
      'badge-unlocked',
      ua.achievement_id,
      'Unlocked ' || a.title,
      ua.unlocked_at
    from public.user_achievements as ua
    join public.achievement_catalog as a on a.id = ua.achievement_id
    where ua.user_id = profile_row.id
    union all
    select
      'course-completed',
      null::text,
      'Finished Logic course',
      max(c.completed_at)
    from public.activity_completions as c
    where c.user_id = profile_row.id
      and c.activity_type = 'lesson'
      and c.activity_id in ('logic-propositions', 'logic-truth-tables', 'logic-predicates')
    having count(distinct c.activity_id) = 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', latest.event_type,
    'activityId', latest.activity_id,
    'label', latest.label,
    'occurredAt', latest.occurred_at
  ) order by latest.occurred_at desc), '[]'::jsonb)
  into activity_data
  from (
    select * from milestones order by occurred_at desc limit 5
  ) as latest;

  return jsonb_build_object(
    'handle', profile_row.public_handle,
    'nickname', profile_row.nickname,
    'title', profile_row.selected_title,
    'level', profile_row.level,
    'memberSince', profile_row.joined_at,
    'sections', jsonb_strip_nulls(jsonb_build_object(
      'studyTime', case when show_study_time then jsonb_build_object(
        'totalSeconds', total_seconds,
        'thisWeekSeconds', week_seconds,
        'averageSecondsPerDay', round(month_seconds::numeric / 30)
      ) end,
      'fastestTimes', case when show_fastest_times then jsonb_build_object('items', fastest_items) end,
      'stats', case when show_stats then stats_data end,
      'badges', case when show_badges then badges_data end,
      'mastery', case when show_mastery then mastery_data end,
      'activity', case when show_activity then activity_data end
    ))
  );
end;
$$;

revoke all on function public.load_public_profile(text, boolean) from public, anon, authenticated;
grant execute on function public.load_public_profile(text, boolean) to anon, authenticated;

create or replace function public.save_profile_presentation(title_id text, target_badge_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  selected_title_value text;
begin
  if owner_id is null then
    raise exception 'Sign in to update your profile presentation.' using errcode = '42501';
  end if;
  if target_badge_ids is null or cardinality(target_badge_ids) > 3
    or cardinality(target_badge_ids) <> (
      select count(distinct requested.badge_id)
      from unnest(target_badge_ids) as requested(badge_id)
    ) then
    raise exception 'Choose up to three unique earned badges.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(target_badge_ids) as requested(badge_id)
    where not exists (
      select 1 from public.user_achievements as ua
      where ua.user_id = owner_id and ua.achievement_id = requested.badge_id
    )
  ) then
    raise exception 'Only earned badges can be pinned.' using errcode = '22023';
  end if;

  if title_id is not null then
    select a.reward_title into selected_title_value
    from public.user_achievements as ua
    join public.achievement_catalog as a on a.id = ua.achievement_id
    where ua.user_id = owner_id and ua.achievement_id = title_id
      and a.reward_title is not null
    limit 1;
    if selected_title_value is null then
      raise exception 'Only an earned title can be selected.' using errcode = '22023';
    end if;
  end if;

  update public.profiles
  set selected_title = selected_title_value,
      pinned_badge_ids = target_badge_ids
  where id = owner_id;

  return jsonb_build_object(
    'selectedTitle', selected_title_value,
    'pinnedBadgeIds', to_jsonb(target_badge_ids)
  );
end;
$$;

revoke all on function public.save_profile_presentation(text, text[]) from public, anon, authenticated;
grant execute on function public.save_profile_presentation(text, text[]) to authenticated;

create or replace function public.block_profile(target_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_id uuid;
begin
  if owner_id is null then
    raise exception 'Sign in to block a profile.' using errcode = '42501';
  end if;
  select p.id into target_id from public.profiles as p where p.public_handle = target_handle;
  if target_id is null or target_id = owner_id then
    raise exception 'This profile cannot be blocked.' using errcode = '22023';
  end if;
  insert into public.profile_blocks (blocker_id, blocked_id)
  values (owner_id, target_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create or replace function public.unblock_profile(target_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Sign in to unblock a profile.' using errcode = '42501';
  end if;
  delete from public.profile_blocks as b
  using public.profiles as p
  where b.blocker_id = owner_id
    and b.blocked_id = p.id
    and p.public_handle = target_handle;
end;
$$;

create or replace function public.list_blocked_profiles()
returns table(public_handle text, nickname text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Sign in to view blocked profiles.' using errcode = '42501';
  end if;
  return query
  select p.public_handle, p.nickname
  from public.profile_blocks as b
  join public.profiles as p on p.id = b.blocked_id
  where b.blocker_id = owner_id
  order by p.nickname;
end;
$$;

create or replace function public.report_profile(target_handle text, report_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_id uuid;
begin
  if owner_id is null then
    raise exception 'Sign in to report a profile.' using errcode = '42501';
  end if;
  if report_reason is null or report_reason not in ('privacy', 'impersonation', 'harassment', 'other') then
    raise exception 'Choose a valid report reason.' using errcode = '22023';
  end if;
  select p.id into target_id from public.profiles as p where p.public_handle = target_handle;
  if target_id is null or target_id = owner_id then
    raise exception 'This profile cannot be reported.' using errcode = '22023';
  end if;
  insert into public.profile_reports (reporter_id, reported_id, reason)
  values (owner_id, target_id, report_reason);
end;
$$;

revoke all on function public.block_profile(text) from public, anon, authenticated;
revoke all on function public.unblock_profile(text) from public, anon, authenticated;
revoke all on function public.list_blocked_profiles() from public, anon, authenticated;
revoke all on function public.report_profile(text, text) from public, anon, authenticated;
grant execute on function public.block_profile(text) to authenticated;
grant execute on function public.unblock_profile(text) to authenticated;
grant execute on function public.list_blocked_profiles() to authenticated;
grant execute on function public.report_profile(text, text) to authenticated;

create or replace function private.sync_leaderboard_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.leaderboard_projection where user_id = old.id;
    return old;
  end if;
  if new.leaderboard_opt_in then
    insert into public.leaderboard_projection (user_id, nickname, xp)
    values (new.id, new.nickname, new.xp)
    on conflict (user_id) do update
      set nickname = excluded.nickname,
          xp = excluded.xp,
          refreshed_at = now();
  else
    delete from public.leaderboard_projection where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_leaderboard_projection() from public, anon, authenticated;
create trigger profiles_sync_leaderboard_projection
  after insert or update of nickname, xp, leaderboard_opt_in on public.profiles
  for each row execute function private.sync_leaderboard_projection();

insert into public.leaderboard_projection (user_id, nickname, xp)
select id, nickname, xp
from public.profiles
where leaderboard_opt_in
on conflict (user_id) do update
  set nickname = excluded.nickname,
      xp = excluded.xp,
      refreshed_at = now();