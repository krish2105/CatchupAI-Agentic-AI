-- Private calendar subscription links. Only a SHA-256 hash of the random token is stored, so a database
-- read can't recreate a working link. Server-written (students can read whether a link exists, and revoke it).
create table public.calendar_feeds (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;
create policy calendar_feeds_select on public.calendar_feeds for select to authenticated using (owner_id = (select auth.uid()));
create policy calendar_feeds_delete on public.calendar_feeds for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.calendar_feeds from anon, authenticated;
grant select (owner_id, created_at), delete on public.calendar_feeds to authenticated;
grant all on public.calendar_feeds to service_role;
