-- Focus Sanctuary: self-tracked study sessions, optionally linked to one of the student's own plan blocks.
alter table public.study_tasks add constraint study_tasks_id_owner_key unique (id, owner_id);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid,
  planned_minutes integer not null check (planned_minutes between 5 and 180),
  focused_minutes integer not null check (focused_minutes between 0 and 240),
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at),
  -- Focused time can never exceed the wall-clock length of the session (+1 min rounding).
  check (focused_minutes <= extract(epoch from (ended_at - started_at)) / 60 + 1),
  foreign key (task_id, owner_id) references public.study_tasks (id, owner_id) on delete set null (task_id)
);
create index focus_sessions_owner_idx on public.focus_sessions (owner_id, started_at desc);

alter table public.focus_sessions enable row level security;
create policy focus_select on public.focus_sessions for select to authenticated using (owner_id = (select auth.uid()));
create policy focus_insert on public.focus_sessions for insert to authenticated with check (owner_id = (select auth.uid()));
create policy focus_delete on public.focus_sessions for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.focus_sessions from anon, authenticated;
grant select, delete on public.focus_sessions to authenticated;
grant insert (task_id, planned_minutes, focused_minutes, started_at, ended_at, completed) on public.focus_sessions to authenticated;
grant all on public.focus_sessions to service_role;
