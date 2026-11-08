-- Local calendar (UAE study defaults): Friday prayer, prayer-time breaks, Ramadan mode and Hijri dates.
-- One row per student; every religious setting is off by default. Prayer times are computed from the chosen city
-- (a fixed list) and method: no coordinates or device location are stored.
create table public.calendar_prefs (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  friday_prayer boolean not null default false,
  prayer_breaks boolean not null default false,
  prayer_city text check (prayer_city in ('abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah', 'al_ain')),
  prayer_method text check (prayer_method in ('dubai', 'umm_al_qura')),
  ramadan_mode boolean not null default false,
  ramadan_reduction_pct smallint not null default 25 check (ramadan_reduction_pct between 0 and 75 and ramadan_reduction_pct % 5 = 0),
  ramadan_start date,
  ramadan_end date,
  ramadan_study_start time,
  show_hijri boolean not null default false,
  -- Server-maintained: last change to a setting that affects planning (drafts made before it are stale).
  rules_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint calendar_prefs_ramadan_dates check ((ramadan_start is null) = (ramadan_end is null) and (ramadan_end is null or ramadan_end - ramadan_start between 0 and 30)),
  constraint calendar_prefs_city_needed check (not (prayer_breaks or ramadan_mode) or (prayer_city is not null and prayer_method is not null))
);
create trigger calendar_prefs_updated before update on public.calendar_prefs for each row execute function public.set_updated_at();

-- Showing Hijri dates is display only, so it doesn't make a pending draft stale; the planning settings do.
create function public.calendar_prefs_rules_changed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.rules_changed_at := case when new.friday_prayer or new.prayer_breaks or new.ramadan_mode then now() end;
  elsif (new.friday_prayer, new.prayer_breaks, new.prayer_city, new.prayer_method, new.ramadan_mode, new.ramadan_reduction_pct,
         new.ramadan_start, new.ramadan_end, new.ramadan_study_start)
        is distinct from
        (old.friday_prayer, old.prayer_breaks, old.prayer_city, old.prayer_method, old.ramadan_mode, old.ramadan_reduction_pct,
         old.ramadan_start, old.ramadan_end, old.ramadan_study_start) then
    new.rules_changed_at := now();
  else
    new.rules_changed_at := old.rules_changed_at;
  end if;
  return new;
end $$;
create trigger calendar_prefs_rules before insert or update on public.calendar_prefs for each row execute function public.calendar_prefs_rules_changed();

alter table public.calendar_prefs enable row level security;
create policy cprefs_select on public.calendar_prefs for select to authenticated using (owner_id = (select auth.uid()));
create policy cprefs_insert on public.calendar_prefs for insert to authenticated with check (owner_id = (select auth.uid()));
create policy cprefs_update on public.calendar_prefs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.calendar_prefs from anon, authenticated;
revoke all on function public.calendar_prefs_rules_changed() from public, anon, authenticated;
grant select on public.calendar_prefs to authenticated;
grant insert (friday_prayer, prayer_breaks, prayer_city, prayer_method, ramadan_mode, ramadan_reduction_pct, ramadan_start, ramadan_end, ramadan_study_start, show_hijri)
  on public.calendar_prefs to authenticated;
grant update (friday_prayer, prayer_breaks, prayer_city, prayer_method, ramadan_mode, ramadan_reduction_pct, ramadan_start, ramadan_end, ramadan_study_start, show_hijri)
  on public.calendar_prefs to authenticated;
grant all on public.calendar_prefs to service_role;
