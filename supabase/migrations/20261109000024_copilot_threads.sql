-- Copilot conversations: a thread groups agent runs so the copilot can use the last few turns as context.
-- Server-written like agent_runs (students read their own; the server creates threads after checking the session).
create table public.copilot_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index copilot_threads_owner_idx on public.copilot_threads (owner_id, updated_at desc);
create trigger copilot_threads_updated before update on public.copilot_threads for each row execute function public.set_updated_at();

alter table public.copilot_threads enable row level security;
create policy cthreads_select on public.copilot_threads for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.copilot_threads from anon, authenticated;
grant select on public.copilot_threads to authenticated;
grant all on public.copilot_threads to service_role;

-- A run belongs to at most one thread of the same student (composite key: no cross-student links).
alter table public.agent_runs add column thread_id uuid;
alter table public.agent_runs
  add constraint agent_runs_thread_fk foreign key (thread_id, owner_id) references public.copilot_threads (id, owner_id) on delete set null (thread_id);
create index agent_runs_thread_idx on public.agent_runs (thread_id, created_at) where thread_id is not null;
