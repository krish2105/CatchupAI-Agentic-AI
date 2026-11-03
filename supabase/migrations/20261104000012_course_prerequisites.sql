-- Learning trail: prerequisite links the student confirms ("course builds on requires_course").
-- Both ends must be the student's own courses (composite keys); cycles are refused by the API.
create table public.course_prerequisites (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  requires_course_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (course_id, requires_course_id),
  check (course_id <> requires_course_id),
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade,
  foreign key (requires_course_id, owner_id) references public.courses (id, owner_id) on delete cascade
);
create index course_prerequisites_owner_idx on public.course_prerequisites (owner_id);

alter table public.course_prerequisites enable row level security;
create policy prereq_select on public.course_prerequisites for select to authenticated using (owner_id = (select auth.uid()));
create policy prereq_insert on public.course_prerequisites for insert to authenticated with check (owner_id = (select auth.uid()));
create policy prereq_delete on public.course_prerequisites for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.course_prerequisites from anon, authenticated;
grant select, delete on public.course_prerequisites to authenticated;
grant insert (course_id, requires_course_id) on public.course_prerequisites to authenticated;
grant all on public.course_prerequisites to service_role;
