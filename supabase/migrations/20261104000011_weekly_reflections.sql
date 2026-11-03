-- Weekly reflection: the student's own words about their week (one row per ISO week, student-owned).
create table public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  went_well text not null default '' check (char_length(went_well) <= 600),
  was_hard text not null default '' check (char_length(was_hard) <= 600),
  next_focus text not null default '' check (char_length(next_focus) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, week_start)
);
create trigger weekly_reflections_updated before update on public.weekly_reflections for each row execute function public.set_updated_at();

alter table public.weekly_reflections enable row level security;
create policy reflections_select on public.weekly_reflections for select to authenticated using (owner_id = (select auth.uid()));
create policy reflections_insert on public.weekly_reflections for insert to authenticated with check (owner_id = (select auth.uid()));
create policy reflections_update on public.weekly_reflections for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy reflections_delete on public.weekly_reflections for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.weekly_reflections from anon, authenticated;
grant select, delete on public.weekly_reflections to authenticated;
grant insert (week_start, went_well, was_hard, next_focus) on public.weekly_reflections to authenticated;
-- week_start is included because an upsert (ON CONFLICT DO UPDATE) sets every supplied column; the Monday check still applies.
grant update (week_start, went_well, was_hard, next_focus) on public.weekly_reflections to authenticated;
grant all on public.weekly_reflections to service_role;
