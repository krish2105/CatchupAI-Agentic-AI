-- Nudges: opt-in daily study digest and missed-block alerts (off by default).
create table public.notification_prefs (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  daily_digest boolean not null default false,
  missed_alert boolean not null default false,
  last_sent_on date,
  updated_at timestamptz not null default now()
);
create trigger notification_prefs_updated before update on public.notification_prefs for each row execute function public.set_updated_at();

alter table public.notification_prefs enable row level security;
create policy nprefs_select on public.notification_prefs for select to authenticated using (owner_id = (select auth.uid()));
create policy nprefs_insert on public.notification_prefs for insert to authenticated with check (owner_id = (select auth.uid()));
create policy nprefs_update on public.notification_prefs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant insert (daily_digest, missed_alert) on public.notification_prefs to authenticated;
grant update (daily_digest, missed_alert) on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;

-- Feedback: a thumbs rating and/or a short comment from the student (real user evidence).
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('plan', 'answer', 'pack', 'teach', 'general')),
  ref text check (ref is null or char_length(ref) <= 100),
  rating smallint check (rating is null or rating in (-1, 1)),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  page text check (page is null or char_length(page) <= 200),
  created_at timestamptz not null default now(),
  check (rating is not null or comment is not null)
);
create index feedback_owner_idx on public.feedback (owner_id, created_at desc);

alter table public.feedback enable row level security;
create policy feedback_select on public.feedback for select to authenticated using (owner_id = (select auth.uid()));
create policy feedback_insert on public.feedback for insert to authenticated with check (owner_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (kind, ref, rating, comment, page) on public.feedback to authenticated;
grant all on public.feedback to service_role;
