-- Rubric Decoder: a preparation checklist per assignment, confirmed by the student from a decoded brief.
-- Student-owned (they choose and edit every item), so RLS allows their own writes; composite keys make
-- items attachable only to the student's own assignment and brief document.
create table public.assignment_checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assignment_id uuid not null,
  kind text not null check (kind in ('criterion', 'deadline', 'deliverable', 'requirement')),
  text text not null check (char_length(text) between 2 and 400),
  weight integer check (weight is null or weight between 1 and 100),
  document_id uuid,
  page integer check (page is null or page between 1 and 500),
  position integer not null check (position between 0 and 99),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  -- If the brief is deleted the item stays; the page number remains as a note but is no longer linked.
  foreign key (assignment_id, owner_id) references public.assignments (id, owner_id) on delete cascade,
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete set null (document_id)
);
create index checklist_assignment_idx on public.assignment_checklist_items (assignment_id, position);

alter table public.assignment_checklist_items enable row level security;
create policy checklist_select on public.assignment_checklist_items for select to authenticated using (owner_id = (select auth.uid()));
create policy checklist_insert on public.assignment_checklist_items for insert to authenticated with check (owner_id = (select auth.uid()));
create policy checklist_update on public.assignment_checklist_items for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy checklist_delete on public.assignment_checklist_items for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.assignment_checklist_items from anon, authenticated;
grant select, delete on public.assignment_checklist_items to authenticated;
grant insert (assignment_id, kind, text, weight, document_id, page, position) on public.assignment_checklist_items to authenticated;
grant update (text, done) on public.assignment_checklist_items to authenticated;
grant all on public.assignment_checklist_items to service_role;
