-- Copilot memory: short notes the student wants the copilot to remember. Students add, edit, confirm and
-- delete their own; the copilot can only SUGGEST (written server-side as status 'suggested').
create table public.copilot_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 3 and 280),
  status text not null default 'confirmed' check (status in ('suggested', 'confirmed')),
  source text not null default 'student' check (source in ('student', 'copilot')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index copilot_memories_owner_idx on public.copilot_memories (owner_id, created_at);
create trigger copilot_memories_updated before update on public.copilot_memories for each row execute function public.set_updated_at();

-- At most 40 memories per student (bounds prompt size and storage).
create function public.copilot_memories_cap() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.copilot_memories where owner_id = new.owner_id) >= 40 then
    raise exception 'memory limit reached' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger copilot_memories_cap before insert on public.copilot_memories for each row execute function public.copilot_memories_cap();

alter table public.copilot_memories enable row level security;
create policy memories_select on public.copilot_memories for select to authenticated using (owner_id = (select auth.uid()));
create policy memories_insert on public.copilot_memories for insert to authenticated with check (owner_id = (select auth.uid()));
create policy memories_update on public.copilot_memories for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy memories_delete on public.copilot_memories for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.copilot_memories from anon, authenticated;
grant select, delete on public.copilot_memories to authenticated;
grant insert (text) on public.copilot_memories to authenticated;
grant update (text, status) on public.copilot_memories to authenticated;
grant all on public.copilot_memories to service_role;

-- Personal MCP access token (one per student). Only a SHA-256 hash is stored; the token is shown once.
create table public.mcp_tokens (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.mcp_tokens enable row level security;
create policy mcp_tokens_select on public.mcp_tokens for select to authenticated using (owner_id = (select auth.uid()));
create policy mcp_tokens_delete on public.mcp_tokens for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.mcp_tokens from anon, authenticated;
grant select (owner_id, created_at, last_used_at), delete on public.mcp_tokens to authenticated;
grant all on public.mcp_tokens to service_role;
