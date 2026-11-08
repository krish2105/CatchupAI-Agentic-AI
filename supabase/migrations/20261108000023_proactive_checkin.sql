-- Proactive check-in (Y2): a daily job notices a student who is slipping, drafts a re-plan with the deterministic
-- planner and records why. The draft is an ordinary pending proposal: it is approved only by the student, through
-- approve_proposal, and dismissing it is reject_proposal. Students keep SELECT only on action_proposals.
alter table public.action_proposals
  add column proactive boolean not null default false,
  add column reason text check (reason is null or char_length(reason) between 1 and 500),
  add column checkin_on date,
  add constraint action_proposals_checkin_is_proactive check (checkin_on is null or proactive);

-- At most one proactive draft per student per (UTC) day, enforced by the database.
create unique index action_proposals_checkin_once on public.action_proposals (owner_id, checkin_on) where checkin_on is not null;

-- Opt-out: check-ins are on unless the student turns them off. A student without a row is opted in.
alter table public.notification_prefs add column proactive_checkin boolean not null default true;
grant insert (proactive_checkin) on public.notification_prefs to authenticated;
grant update (proactive_checkin) on public.notification_prefs to authenticated;
