-- OPTIONAL. Run once in the Supabase SQL Editor on an existing database.
--
-- 1. Study streaks use Philippine time. Without this, the server's UTC date rolls over at
--    8:00 AM in Manila, so a student who studies at 7:30 AM and again at 9:00 AM
--    on the same morning could be counted as two different days.
-- 2. Nicknames are unique ignoring capital letters ("Kian" and "kian" were allowed to coexist).
--    The index creation FAILS if two existing nicknames already differ only by case.
--    If it does, rename one of them in Table Editor and run this file again.

create or replace function public.refresh_profile_from_progress(target_user uuid, touch_activity boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  completed_count integer;
  manila_today date := (now() at time zone 'Asia/Manila')::date;
begin
  select count(*) into completed_count from public.lesson_progress where user_id = target_user;
  update public.profiles
  set xp = completed_count * 50,
      level = floor((completed_count * 50)::numeric / 150)::integer + 1,
      streak = case
        when not touch_activity then streak
        when last_active = manila_today then streak
        when last_active = manila_today - 1 then streak + 1
        else 1
      end,
      last_active = case when touch_activity then manila_today else last_active end
  where id = target_user;
end;
$$;

revoke all on function public.refresh_profile_from_progress(uuid, boolean) from public;

create unique index if not exists profiles_nickname_lower_key on public.profiles (lower(nickname));
