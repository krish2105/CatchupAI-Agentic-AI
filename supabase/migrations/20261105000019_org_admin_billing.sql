-- Organisation administration and billing (Batch C, after 0018).
--  * Audit log per organisation: who did what (created, joined, left, role changed, code rotated, sharing
--    changed, plan changed). Admins of that organisation read it; nobody writes it directly.
--  * Join-code rotation by admins (an old code stops working at once).
--  * Seats: each organisation has a member limit from its plan (free: 40); joining a full organisation fails.
--  * Billing state per organisation, written only by the server (service role) from verified Stripe webhooks,
--    with a processed-events table so a webhook delivered twice is applied once.

alter table public.organizations
  add column plan text not null default 'free' check (plan in ('free', 'class')),
  add column plan_status text not null default 'none' check (plan_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  add column seat_limit integer not null default 40 check (seat_limit between 1 and 5000),
  add column current_period_end timestamptz,
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  -- Stripe can deliver events out of order: only an event newer than the last one applied changes the plan.
  add column billing_event_at timestamptz;
-- Members may read the plan and seat limit (column grants; billing ids stay server-only).
grant select (plan, plan_status, seat_limit, current_period_end) on public.organizations to authenticated;

create table public.org_audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('org.created', 'member.joined', 'member.left', 'member.role_changed', 'member.sharing_changed', 'code.rotated', 'plan.changed')),
  target_user uuid references auth.users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);
create index org_audit_events_org_idx on public.org_audit_events (org_id, created_at desc);
alter table public.org_audit_events enable row level security;
create policy org_audit_select on public.org_audit_events for select to authenticated using (public.org_role(org_id) = 'admin');
revoke all on public.org_audit_events from anon, authenticated;
grant select on public.org_audit_events to authenticated;
grant all on public.org_audit_events to service_role;

create table public.stripe_events (
  id text primary key check (char_length(id) between 3 and 255),
  type text not null,
  org_id uuid references public.organizations (id) on delete set null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
grant all on public.stripe_events to service_role;

create function public.audit_org(p_org uuid, p_action text, p_target uuid default null, p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.org_audit_events (org_id, actor_id, action, target_user, detail) values (p_org, (select auth.uid()), p_action, p_target, p_detail)
$$;
revoke all on function public.audit_org(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- 0018's functions, now with audit entries and the seat limit.
create or replace function public.create_organization(p_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_full_account();
  if (select count(*) from public.organizations where created_by = (select auth.uid())) >= 5 then
    raise exception 'organisation limit reached' using errcode = '23514';
  end if;
  insert into public.organizations (name, join_code, created_by) values (btrim(p_name), public.new_join_code(), (select auth.uid())) returning id into v_id;
  insert into public.memberships (org_id, user_id, role) values (v_id, (select auth.uid()), 'admin');
  perform public.audit_org(v_id, 'org.created', null, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end $$;

create or replace function public.join_organization(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_limit integer; v_inserted integer;
begin
  perform public.require_full_account();
  select id, seat_limit into v_id, v_limit from public.organizations where join_code = upper(btrim(p_code));
  if v_id is null then raise exception 'invalid join code' using errcode = 'P0002'; end if;
  if exists (select 1 from public.memberships where org_id = v_id and user_id = (select auth.uid())) then return v_id; end if;
  -- Serialise joins per organisation so two students can't both take the last seat.
  perform 1 from public.organizations where id = v_id for update;
  if (select count(*) from public.memberships where org_id = v_id) >= v_limit then
    raise exception 'organisation is full' using errcode = '23514';
  end if;
  insert into public.memberships (org_id, user_id) values (v_id, (select auth.uid())) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then perform public.audit_org(v_id, 'member.joined', (select auth.uid())); end if;
  return v_id;
end $$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role text) returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role not in ('student', 'teacher', 'admin') then raise exception 'invalid role' using errcode = '22023'; end if;
  select role into v_old from public.memberships where org_id = p_org and user_id = p_user;
  if v_old is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if p_role <> 'admin' and v_old = 'admin' and (select count(*) from public.memberships where org_id = p_org and role = 'admin') = 1 then
    raise exception 'an organisation needs an admin' using errcode = '23514';
  end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
  if v_old <> p_role then perform public.audit_org(p_org, 'member.role_changed', p_user, jsonb_build_object('from', v_old, 'to', p_role)); end if;
end $$;

create or replace function public.set_share_progress(p_org uuid, p_share boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.memberships set share_progress = p_share where org_id = p_org and user_id = (select auth.uid());
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  perform public.audit_org(p_org, 'member.sharing_changed', (select auth.uid()), jsonb_build_object('share', p_share));
end $$;

create or replace function public.leave_organization(p_org uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.org_role(p_org) = 'admin' and (select count(*) from public.memberships where org_id = p_org and role = 'admin') = 1
     and (select count(*) from public.memberships where org_id = p_org) > 1 then
    raise exception 'make another member admin before leaving' using errcode = '23514';
  end if;
  delete from public.memberships where org_id = p_org and user_id = (select auth.uid());
  if found then perform public.audit_org(p_org, 'member.left', (select auth.uid())); end if;
  delete from public.organizations o where o.id = p_org and not exists (select 1 from public.memberships m where m.org_id = p_org);
end $$;

-- Admins rotate the join code; the old one stops working immediately.
create function public.rotate_join_code(p_org uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  v_code := public.new_join_code();
  update public.organizations set join_code = v_code where id = p_org;
  perform public.audit_org(p_org, 'code.rotated');
  return v_code;
end $$;

-- Server only (called with the service role from a verified Stripe webhook). Idempotent per Stripe event id.
create function public.apply_org_subscription(p_event_id text, p_event_type text, p_event_at timestamptz, p_org uuid, p_plan text, p_status text, p_seats integer,
  p_period_end timestamptz, p_customer text, p_subscription text) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_old text; v_last timestamptz;
begin
  select plan, billing_event_at into v_old, v_last from public.organizations where id = p_org for update;
  if v_old is null then return false; end if; -- organisation deleted meanwhile
  insert into public.stripe_events (id, type, org_id) values (p_event_id, p_event_type, p_org) on conflict (id) do nothing;
  if not found then return false; end if; -- already processed
  if v_last is not null and p_event_at <= v_last then return false; end if; -- older than what is applied
  update public.organizations set plan = p_plan, plan_status = p_status, seat_limit = greatest(1, least(5000, p_seats)), current_period_end = p_period_end,
    stripe_customer_id = coalesce(p_customer, stripe_customer_id), stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id), billing_event_at = p_event_at
  where id = p_org;
  insert into public.org_audit_events (org_id, actor_id, action, detail) values (p_org, null, 'plan.changed', jsonb_build_object('from', v_old, 'to', p_plan, 'status', p_status, 'seats', p_seats));
  return true;
end $$;
revoke all on function public.apply_org_subscription(text, text, timestamptz, uuid, text, text, integer, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.apply_org_subscription(text, text, timestamptz, uuid, text, text, integer, timestamptz, text, text) to service_role;

-- The billing customer id for an admin starting checkout or the billing portal (never exposed to other members).
create function public.org_billing(p_org uuid) returns table (plan text, plan_status text, seat_limit integer, members integer, current_period_end timestamptz, has_customer boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select o.plan, o.plan_status, o.seat_limit, (select count(*)::integer from public.memberships m where m.org_id = o.id), o.current_period_end, o.stripe_customer_id is not null
    from public.organizations o where o.id = p_org;
end $$;

revoke all on function public.rotate_join_code(uuid), public.org_billing(uuid) from public, anon;
grant execute on function public.rotate_join_code(uuid), public.org_billing(uuid) to authenticated;
