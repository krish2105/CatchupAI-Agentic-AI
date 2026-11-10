-- Night Coach: a scheduled agent pipeline that checks each student overnight and leaves a morning brief.
-- Server-owned: students read (and may delete, to dismiss) their own briefs; only the server writes them.
create table public.coach_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  brief_on date not null,
  cards jsonb not null check (jsonb_typeof(cards) = 'array'),
  run_id uuid,
  created_at timestamptz not null default now(),
  unique (owner_id, brief_on)
);
create index coach_briefs_owner_idx on public.coach_briefs (owner_id, brief_on desc);

alter table public.coach_briefs enable row level security;
create policy coach_briefs_select on public.coach_briefs for select to authenticated using (owner_id = (select auth.uid()));
create policy coach_briefs_delete on public.coach_briefs for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.coach_briefs from anon, authenticated;
grant select, delete on public.coach_briefs to authenticated;
grant all on public.coach_briefs to service_role;
