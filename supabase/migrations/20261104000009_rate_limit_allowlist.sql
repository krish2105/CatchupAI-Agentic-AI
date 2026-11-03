-- Security hardening (SECURITY_AUDIT.md M-2): consume_rate_limit is SECURITY DEFINER and callable by any
-- signed-in student through PostgREST. It previously accepted any bucket name and window, so a student could
-- create unbounded counter rows. Buckets are now an allowlist with fixed windows (matching
-- src/lib/http/rate-limit.ts); unknown buckets or mismatched windows are rejected. Additive and reversible:
-- re-applying the previous definition from 20261103000001 restores the old behaviour.
create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_expected integer;
  v_window timestamptz;
  v_hits integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  v_expected := case p_bucket
    when 'write' then 60
    when 'upload' then 3600
    when 'agent' then 86400
    when 'quiz' then 86400
    when 'teach' then 86400
    when 'compute' then 3600
    when 'account' then 3600
    when 'agent_demo' then 86400
    when 'upload_demo' then 3600
    when 'quiz_demo' then 86400
    when 'teach_demo' then 86400
  end;
  if v_expected is null or p_window_seconds <> v_expected or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_counters as c (owner_id, bucket, window_start, hits)
  values (v_uid, p_bucket, v_window, 1)
  on conflict (owner_id, bucket, window_start) do update set hits = c.hits + 1
  returning hits into v_hits;
  delete from public.rate_limit_counters
   where owner_id = v_uid and bucket = p_bucket and window_start < v_window;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;
