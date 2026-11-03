-- Human approval gate for recovery plans.
--
-- Proposals are created only by trusted server code (students have SELECT-only access). The functions below
-- run as SECURITY DEFINER so they can write plan/task rows that students cannot insert directly, and they
-- re-derive the caller from auth.uid() — the proposal must belong to the caller.
--
-- approve_proposal is atomic and idempotent:
--   * the proposal row is locked FOR UPDATE, so concurrent approvals serialize;
--   * an already-approved proposal returns the same plan and task ids (no new rows);
--   * expired, rejected, infeasible or stale proposals are refused (stale = the student's assignments or
--     availability changed after the proposal was computed);
--   * task invariants are enforced by constraints (owned course FK, duration, no overlap) and by an explicit
--     deadline check for assignment work.

create or replace function public.approve_proposal(p_proposal_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.action_proposals%rowtype;
  v_plan uuid;
  v_task_ids uuid[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  select * into v_p from public.action_proposals where id = p_proposal_id and owner_id = v_uid for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_p.status = 'approved' then
    select array_agg(id order by position) into v_task_ids from public.study_tasks where plan_id = v_p.applied_plan_id;
    return jsonb_build_object('outcome', 'approved', 'alreadyApplied', true, 'planId', v_p.applied_plan_id, 'taskIds', to_jsonb(coalesce(v_task_ids, '{}')));
  end if;
  if v_p.status <> 'pending' then
    return jsonb_build_object('outcome', v_p.status);
  end if;
  if v_p.expires_at <= now() then
    update public.action_proposals set status = 'expired', decided_at = now() where id = v_p.id;
    return jsonb_build_object('outcome', 'expired');
  end if;
  if not v_p.feasible then
    return jsonb_build_object('outcome', 'infeasible');
  end if;
  if exists (select 1 from public.assignments where owner_id = v_uid and updated_at > v_p.created_at)
     or exists (select 1 from public.profiles where id = v_uid and updated_at > v_p.created_at) then
    update public.action_proposals set status = 'expired', decided_at = now() where id = v_p.id;
    return jsonb_build_object('outcome', 'stale');
  end if;

  -- Supersede the current plan: unfinished tasks are cancelled, all its tasks leave the overlap rule.
  update public.study_tasks
     set status = case when status = 'todo' then 'cancelled' else status end, active = false
   where owner_id = v_uid and active;
  update public.study_plans set status = 'superseded', superseded_at = now() where owner_id = v_uid and status = 'active';

  insert into public.study_plans (owner_id, proposal_id, title, scenario, feasibility)
  values (v_uid, v_p.id, left(coalesce(v_p.payload ->> 'title', 'Recovery plan'), 160), v_p.scenario, coalesce(v_p.payload -> 'summary', '{}'::jsonb))
  returning id into v_plan;

  insert into public.study_tasks (owner_id, plan_id, course_id, assignment_id, title, kind, starts_at, ends_at, position, evidence)
  select v_uid, v_plan,
         (t ->> 'courseId')::uuid,
         nullif(t ->> 'assignmentId', '')::uuid,
         left(t ->> 'title', 200),
         t ->> 'kind',
         (t ->> 'startsAt')::timestamptz,
         (t ->> 'endsAt')::timestamptz,
         (ord - 1)::integer,
         coalesce(t -> 'evidence', '[]'::jsonb)
    from jsonb_array_elements(v_p.payload -> 'tasks') with ordinality as x(t, ord);

  if exists (
    select 1 from public.study_tasks st join public.assignments a on a.id = st.assignment_id
     where st.plan_id = v_plan and st.ends_at > a.due_at
  ) then
    raise exception 'a task ends after its assignment deadline' using errcode = '23514';
  end if;

  update public.action_proposals
     set status = 'approved', decided_at = now(), approval_key = p_idempotency_key, applied_plan_id = v_plan
   where id = v_p.id;
  update public.action_proposals set status = 'expired', decided_at = now()
   where owner_id = v_uid and status = 'pending' and id <> v_p.id;

  select array_agg(id order by position) into v_task_ids from public.study_tasks where plan_id = v_plan;
  return jsonb_build_object('outcome', 'approved', 'alreadyApplied', false, 'planId', v_plan, 'taskIds', to_jsonb(coalesce(v_task_ids, '{}')));
end;
$$;

create or replace function public.reject_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select status into v_status from public.action_proposals where id = p_proposal_id and owner_id = v_uid for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if v_status = 'pending' then
    update public.action_proposals set status = 'rejected', decided_at = now() where id = p_proposal_id;
    return jsonb_build_object('outcome', 'rejected');
  end if;
  return jsonb_build_object('outcome', v_status);
end;
$$;

revoke all on function public.approve_proposal(uuid, text) from public, anon;
revoke all on function public.reject_proposal(uuid) from public, anon;
grant execute on function public.approve_proposal(uuid, text) to authenticated, service_role;
grant execute on function public.reject_proposal(uuid) to authenticated, service_role;
