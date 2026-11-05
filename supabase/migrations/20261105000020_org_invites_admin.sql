-- Organisation invitations and admin console (SaaS plan A2 + A3).
--  * Email invites: an admin invites an address with a role. Only hashes are stored (sha-256 of the lower-cased
--    email and of the one-time token); the token is returned once to the server, which emails or shows the link.
--    The invitee must be signed in with that same email to accept. Invites expire after 7 days and can be
--    resent (new token, new expiry) or revoked. Seat limits apply as for join codes.
--  * Admin actions: remove a member (never the last admin), rename, delete (type the name to confirm).
--  * Every action is audited. Nobody reads or writes org_invites directly: only these functions.

alter table public.org_audit_events drop constraint org_audit_events_action_check;
alter table public.org_audit_events add constraint org_audit_events_action_check check (action in (
  'org.created', 'member.joined', 'member.left', 'member.role_changed', 'member.sharing_changed', 'code.rotated', 'plan.changed',
  'invite.created', 'invite.resent', 'invite.revoked', 'invite.accepted', 'member.removed', 'org.renamed'
));

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  -- Masked for the admin's list (e.g. "j•••@example.com"); never the full address.
  email_hint text not null check (char_length(email_hint) between 3 and 120),
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index org_invites_org_idx on public.org_invites (org_id, created_at desc);
create unique index org_invites_one_open_per_email on public.org_invites (org_id, email_hash) where accepted_at is null and revoked_at is null;
alter table public.org_invites enable row level security;
revoke all on public.org_invites from anon, authenticated;
grant all on public.org_invites to service_role;

create function public.org_sha256(p text) returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p, 'sha256'), 'hex');
$$;

create function public.mask_email(p text) returns text language sql immutable set search_path = '' as $$
  select left(split_part(p, '@', 1), 1) || '•••@' || split_part(p, '@', 2);
$$;

-- Admin: invite an email address. Returns the one-time token (only its hash is stored).
create function public.create_org_invite(p_org uuid, p_email text, p_role text) returns table (invite_id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(p_email)); v_token text; v_id uuid;
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'invalid email' using errcode = '22023'; end if;
  if p_role not in ('student', 'teacher', 'admin') then raise exception 'invalid role' using errcode = '22023'; end if;
  if (select count(*) from public.org_invites where org_id = p_org and accepted_at is null and revoked_at is null and expires_at > now()) >= 200 then
    raise exception 'too many open invites' using errcode = '23514';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  -- A new invite to the same address replaces the open one.
  update public.org_invites set revoked_at = now() where org_id = p_org and email_hash = public.org_sha256(v_email) and accepted_at is null and revoked_at is null;
  insert into public.org_invites (org_id, email_hash, email_hint, role, token_hash, created_by, expires_at)
    values (p_org, public.org_sha256(v_email), public.mask_email(v_email), p_role, public.org_sha256(v_token), (select auth.uid()), now() + interval '7 days')
    returning id into v_id;
  perform public.audit_org(p_org, 'invite.created', null, jsonb_build_object('role', p_role, 'email', public.mask_email(v_email)));
  return query select v_id, v_token;
end $$;

-- Admin: a fresh token and expiry for an open invite (the old link stops working).
create function public.resend_org_invite(p_invite uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_token text;
begin
  select org_id into v_org from public.org_invites where id = p_invite and accepted_at is null and revoked_at is null;
  if v_org is null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if coalesce(public.org_role(v_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  update public.org_invites set token_hash = public.org_sha256(v_token), expires_at = now() + interval '7 days' where id = p_invite;
  perform public.audit_org(v_org, 'invite.resent');
  return v_token;
end $$;

create function public.revoke_org_invite(p_invite uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.org_invites where id = p_invite and accepted_at is null and revoked_at is null;
  if v_org is null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if coalesce(public.org_role(v_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.org_invites set revoked_at = now() where id = p_invite;
  perform public.audit_org(v_org, 'invite.revoked');
end $$;

-- Admin: the organisation's invites (masked email, role, state).
create function public.org_invite_list(p_org uuid) returns table (id uuid, email_hint text, role text, created_at timestamptz, expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select i.id, i.email_hint, i.role, i.created_at, i.expires_at, i.accepted_at, i.revoked_at from public.org_invites i where i.org_id = p_org order by i.created_at desc limit 200;
end $$;

-- The signed-in invitee accepts with the token from the link; their verified email must match the invite.
create function public.accept_org_invite(p_token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.org_invites%rowtype; v_email text := lower(coalesce((select auth.jwt()) ->> 'email', '')); v_limit integer;
begin
  perform public.require_full_account();
  select * into v from public.org_invites where token_hash = public.org_sha256(btrim(p_token)) for update;
  if v.id is null or v.revoked_at is not null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if v.accepted_at is not null then raise exception 'invite already used' using errcode = 'P0002'; end if;
  if v.expires_at <= now() then raise exception 'invite expired' using errcode = 'P0002'; end if;
  if v_email = '' or public.org_sha256(v_email) <> v.email_hash then raise exception 'invite is for another email' using errcode = '42501'; end if;
  if exists (select 1 from public.memberships where org_id = v.org_id and user_id = (select auth.uid())) then
    update public.org_invites set accepted_at = now(), accepted_by = (select auth.uid()) where id = v.id;
    return v.org_id;
  end if;
  select seat_limit into v_limit from public.organizations where id = v.org_id for update;
  if (select count(*) from public.memberships where org_id = v.org_id) >= v_limit then raise exception 'organisation is full' using errcode = '23514'; end if;
  insert into public.memberships (org_id, user_id, role) values (v.org_id, (select auth.uid()), v.role);
  update public.org_invites set accepted_at = now(), accepted_by = (select auth.uid()) where id = v.id;
  perform public.audit_org(v.org_id, 'invite.accepted', (select auth.uid()), jsonb_build_object('role', v.role));
  return v.org_id;
end $$;

-- Admin: remove a member (not yourself: use leave; never the last admin).
create function public.remove_org_member(p_org uuid, p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'use leave to remove yourself' using errcode = '22023'; end if;
  select role into v_role from public.memberships where org_id = p_org and user_id = p_user;
  if v_role is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if v_role = 'admin' and (select count(*) from public.memberships where org_id = p_org and role = 'admin') = 1 then
    raise exception 'an organisation needs an admin' using errcode = '23514';
  end if;
  delete from public.memberships where org_id = p_org and user_id = p_user;
  perform public.audit_org(p_org, 'member.removed', p_user, jsonb_build_object('role', v_role));
end $$;

create function public.rename_organization(p_org uuid, p_name text) returns void language plpgsql security definer set search_path = '' as $$
declare v_old text; v_name text := btrim(p_name);
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid name' using errcode = '22023'; end if;
  select name into v_old from public.organizations where id = p_org;
  update public.organizations set name = v_name where id = p_org;
  perform public.audit_org(p_org, 'org.renamed', null, jsonb_build_object('from', v_old, 'to', v_name));
end $$;

-- Admin: delete the organisation. The exact current name must be typed to confirm. Memberships, invites and the
-- audit log go with it; students' own study data is untouched. A paid plan must be cancelled first.
create function public.delete_organization(p_org uuid, p_confirm_name text) returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_plan text; v_status text;
begin
  if coalesce(public.org_role(p_org), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  select name, plan, plan_status into v_name, v_plan, v_status from public.organizations where id = p_org for update;
  if v_name is distinct from btrim(p_confirm_name) then raise exception 'name does not match' using errcode = '22023'; end if;
  if v_plan = 'class' and v_status in ('active', 'trialing', 'past_due') then raise exception 'cancel the paid plan first' using errcode = '23514'; end if;
  delete from public.organizations where id = p_org;
end $$;

revoke all on function public.create_org_invite(uuid, text, text), public.resend_org_invite(uuid), public.revoke_org_invite(uuid), public.org_invite_list(uuid),
  public.accept_org_invite(text), public.remove_org_member(uuid, uuid), public.rename_organization(uuid, text), public.delete_organization(uuid, text),
  public.org_sha256(text), public.mask_email(text) from public, anon;
grant execute on function public.create_org_invite(uuid, text, text), public.resend_org_invite(uuid), public.revoke_org_invite(uuid), public.org_invite_list(uuid),
  public.accept_org_invite(text), public.remove_org_member(uuid, uuid), public.rename_organization(uuid, text), public.delete_organization(uuid, text) to authenticated;
grant execute on function public.org_sha256(text), public.mask_email(text) to service_role;
