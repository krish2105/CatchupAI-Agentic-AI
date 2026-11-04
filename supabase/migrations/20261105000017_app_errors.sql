-- Self-hosted error tracking (batch D). One row per error group (fingerprint), written only by the server
-- through record_app_error() with text that was already redacted (no secrets, emails, ids, IPs, numbers).
-- Students and anonymous callers have no access at all: RLS is on with no policies and every grant is
-- revoked; only the service role (server code, the owner's /ops page, the alert job) can read it.
create table public.app_error_groups (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{16}$'),
  source text not null check (source in ('route', 'boundary', 'agent', 'cron')),
  path text not null check (char_length(path) between 1 and 200),
  error_name text not null check (char_length(error_name) between 1 and 100),
  message text not null check (char_length(message) <= 500),
  stack text check (stack is null or char_length(stack) <= 2000),
  release text check (release is null or char_length(release) <= 40),
  count integer not null default 1 check (count >= 1),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  -- Set by the alert job once this group has been reported; cleared when a resolved group comes back.
  notified_at timestamptz,
  resolved_at timestamptz
);
create index app_error_groups_last_seen_idx on public.app_error_groups (last_seen desc);
create index app_error_groups_unnotified_idx on public.app_error_groups (first_seen) where notified_at is null;

alter table public.app_error_groups enable row level security;
revoke all on public.app_error_groups from anon, authenticated;
grant all on public.app_error_groups to service_role;

create function public.record_app_error(
  p_fingerprint text, p_source text, p_path text, p_name text, p_message text, p_stack text, p_release text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.app_error_groups as g (fingerprint, source, path, error_name, message, stack, release)
  values (p_fingerprint, p_source, p_path, p_name, p_message, p_stack, p_release)
  on conflict (fingerprint) do update set
    count = g.count + 1,
    last_seen = now(),
    message = excluded.message,
    stack = coalesce(excluded.stack, g.stack),
    release = excluded.release,
    -- A resolved group that happens again is a regression: reopen it and alert again.
    notified_at = case when g.resolved_at is not null then null else g.notified_at end,
    resolved_at = null;
$$;
revoke execute on function public.record_app_error(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_app_error(text, text, text, text, text, text, text) to service_role;
