-- Institutions and memberships (Batch C). A student, teacher or admin belongs to an organisation through a
-- membership. Teachers and admins see CLASS AGGREGATES ONLY, and only from students who chose to share
-- (share_progress, off by default), and only when at least 3 students share, so no single student's numbers can
-- be read off a total. Nobody in an organisation can read another member's courses, notes, documents, answers
-- or plans: those tables keep their owner-only RLS, unchanged.
--
-- Writes go through SECURITY DEFINER functions (create, join by code, set role, leave, share); members can only
-- SELECT through RLS. Demo (anonymous) accounts can't create or join organisations.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  -- 10-character join code (no 0/O/1/I), rotated by an admin; knowing it is what lets a student join.
  join_code text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  share_progress boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Helpers (SECURITY DEFINER so policies can ask about memberships without recursing into memberships' RLS).
create function public.org_role(p_org uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m where m.org_id = p_org and m.user_id = (select auth.uid())
$$;
create function public.is_org_member(p_org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = (select auth.uid()))
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- Members see their organisation; only staff see the join code (column grant below + a function for staff).
create policy organizations_select on public.organizations for select to authenticated using (public.is_org_member(id));
-- A member sees their own membership; staff see the member list of their organisation (role and sharing flag only).
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.org_role(org_id) in ('teacher', 'admin'));

revoke all on public.organizations from anon, authenticated;
revoke all on public.memberships from anon, authenticated;
grant select (id, name, created_at) on public.organizations to authenticated;
grant select on public.memberships to authenticated;
grant all on public.organizations to service_role;
grant all on public.memberships to service_role;

create function public.new_join_code() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 10)
$$;

create function public.require_full_account() returns void language plpgsql stable set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'demo accounts cannot use organisations' using errcode = '42501';
  end if;
end $$;

-- Creates an organisation with the caller as its admin. At most 5 created per account.
create function public.create_organization(p_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_full_account();
  if (select count(*) from public.organizations where created_by = (select auth.uid())) >= 5 then
    raise exception 'organisation limit reached' using errcode = '23514';
  end if;
  insert into public.organizations (name, join_code, created_by) values (btrim(p_name), public.new_join_code(), (select auth.uid())) returning id into v_id;
  insert into public.memberships (org_id, user_id, role) values (v_id, (select auth.uid()), 'admin');
  return v_id;
end $$;

-- Joins by code as a student (sharing off). Idempotent; an existing membership keeps its role.
create function public.join_organization(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_full_account();
  select id into v_id from public.organizations where join_code = upper(btrim(p_code));
  if v_id is null then raise exception 'invalid join code' using errcode = 'P0002'; end if;
  insert into public.memberships (org_id, user_id) values (v_id, (select auth.uid())) on conflict do nothing;
  return v_id;
end $$;

-- The join code, for staff only.
create function public.organization_join_code(p_org uuid) returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.org_role(p_org), '') not in ('teacher', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select join_code from public.organizations where id = p_org);
end $$;

-- Admins change roles; the last admin can't be demoted (an organisation always has one).
create function public.set_member_role(p_org uuid, p_user uuid, p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role not in ('student', 'teacher', 'admin') then raise exception 'invalid role' using errcode = '22023'; end if;
  if p_role <> 'admin' and (select role from public.memberships where org_id = p_org and user_id = p_user) = 'admin'
     and (select count(*) from public.memberships where org_id = p_org and role = 'admin') = 1 then
    raise exception 'an organisation needs an admin' using errcode = '23514';
  end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
end $$;

-- The student's own consent to count in class aggregates.
create function public.set_share_progress(p_org uuid, p_share boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.memberships set share_progress = p_share where org_id = p_org and user_id = (select auth.uid());
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
end $$;

-- Leaving; the last admin must hand over first.
create function public.leave_organization(p_org uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.org_role(p_org) = 'admin' and (select count(*) from public.memberships where org_id = p_org and role = 'admin') = 1
     and (select count(*) from public.memberships where org_id = p_org) > 1 then
    raise exception 'make another member admin before leaving' using errcode = '23514';
  end if;
  delete from public.memberships where org_id = p_org and user_id = (select auth.uid());
  -- The last member leaving removes the organisation.
  delete from public.organizations o where o.id = p_org and not exists (select 1 from public.memberships m where m.org_id = p_org);
end $$;

-- The roster for staff: display name, role and sharing flag only (no email, no study data).
create function public.org_members(p_org uuid) returns table (user_id uuid, display_name text, role text, share_progress boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.org_role(p_org), '') not in ('teacher', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select m.user_id, coalesce(p.display_name, 'Student'), m.role, m.share_progress, m.created_at
    from public.memberships m left join public.profiles p on p.id = m.user_id where m.org_id = p_org order by m.role, p.display_name;
end $$;

-- Class aggregates for staff: counts and averages over consenting students only, hidden below 3 of them.
create function public.org_class_summary(p_org uuid, p_since timestamptz) returns table (
  members integer, students integer, sharing integer, shown boolean,
  blocks_completed integer, minutes_completed integer, assignments_due_7d integer, overdue_assignments integer, avg_latest_quiz numeric
) language plpgsql stable security definer set search_path = '' as $$
declare v_ids uuid[]; v_sharing integer;
begin
  if coalesce(public.org_role(p_org), '') not in ('teacher', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  select array_agg(user_id) into v_ids from public.memberships where org_id = p_org and role = 'student' and share_progress;
  v_sharing := coalesce(array_length(v_ids, 1), 0);
  members := (select count(*) from public.memberships where org_id = p_org);
  students := (select count(*) from public.memberships where org_id = p_org and role = 'student');
  sharing := v_sharing;
  shown := v_sharing >= 3;
  if not shown then
    return next;
    return;
  end if;
  blocks_completed := (select count(*) from public.study_tasks where owner_id = any (v_ids) and status = 'completed' and completed_at >= p_since);
  minutes_completed := (select coalesce(sum(duration_minutes), 0) from public.study_tasks where owner_id = any (v_ids) and status = 'completed' and completed_at >= p_since);
  assignments_due_7d := (select count(*) from public.assignments where owner_id = any (v_ids) and status <> 'completed' and due_at between now() and now() + interval '7 days');
  overdue_assignments := (select count(*) from public.assignments where owner_id = any (v_ids) and status <> 'completed' and due_at < now());
  avg_latest_quiz := (
    select round(avg(score_percent), 1) from (
      select distinct on (owner_id) owner_id, score_percent from public.quiz_attempts where owner_id = any (v_ids) order by owner_id, created_at desc
    ) latest
  );
  return next;
end $$;

revoke all on function public.org_role(uuid), public.is_org_member(uuid), public.new_join_code(), public.require_full_account() from public, anon;
revoke all on function public.create_organization(text), public.join_organization(text), public.organization_join_code(uuid),
  public.set_member_role(uuid, uuid, text), public.set_share_progress(uuid, boolean), public.leave_organization(uuid),
  public.org_class_summary(uuid, timestamptz), public.org_members(uuid) from public, anon;
grant execute on function public.org_role(uuid), public.is_org_member(uuid) to authenticated;
grant execute on function public.create_organization(text), public.join_organization(text), public.organization_join_code(uuid),
  public.set_member_role(uuid, uuid, text), public.set_share_progress(uuid, boolean), public.leave_organization(uuid),
  public.org_class_summary(uuid, timestamptz), public.org_members(uuid) to authenticated;
