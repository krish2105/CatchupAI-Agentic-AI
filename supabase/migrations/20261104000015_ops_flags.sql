-- Operator controls for AI spend and emergencies. One row; readable and writable only by the server
-- (service role) and by the project owner in the Supabase dashboard. Students have no access.
create table public.ops_flags (
  id smallint primary key default 1 check (id = 1),
  ai_enabled boolean not null default true,
  daily_token_budget integer not null default 2000000 check (daily_token_budget >= 0),
  note text check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
create trigger ops_flags_updated before update on public.ops_flags for each row execute function public.set_updated_at();
insert into public.ops_flags (id) values (1);

alter table public.ops_flags enable row level security;
revoke all on public.ops_flags from anon, authenticated;
grant all on public.ops_flags to service_role;

-- Fast "tokens used today" and "run in progress" checks.
create index if not exists agent_runs_created_idx on public.agent_runs (created_at);
create index if not exists agent_runs_owner_status_idx on public.agent_runs (owner_id, status);

-- Per-token request budget for the MCP endpoint (callers authenticate with a token, not a Supabase session,
-- so consume_rate_limit's auth.uid() doesn't apply). Server-only.
create table public.mcp_usage (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
alter table public.mcp_usage enable row level security;
revoke all on public.mcp_usage from anon, authenticated;
grant all on public.mcp_usage to service_role;

create function public.consume_mcp_quota(p_owner uuid, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.mcp_usage as u (owner_id, window_start, count) values (p_owner, now(), 1)
  on conflict (owner_id) do update set
    window_start = case when u.window_start < now() - make_interval(secs => p_window_seconds) then now() else u.window_start end,
    count = case when u.window_start < now() - make_interval(secs => p_window_seconds) then 1 else u.count + 1 end
  returning count into v_count;
  return v_count <= p_limit;
end $$;
revoke all on function public.consume_mcp_quota(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_mcp_quota(uuid, integer, integer) to service_role;
