-- Teach-It-Back: the student's own explanation of a topic and the server-computed, cited feedback.
-- Server-owned like quiz attempts: students can read and delete their rows, but only the server writes them,
-- so coverage scores can't be forged through the public API.
create table public.teach_back_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null,
  topic text not null check (char_length(topic) between 2 and 120),
  explanation text not null check (char_length(explanation) between 1 and 4000),
  coverage_percent integer not null check (coverage_percent between 0 and 100),
  concepts jsonb not null check (jsonb_typeof(concepts) = 'array'),
  created_at timestamptz not null default now(),
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade
);
create index teach_back_owner_idx on public.teach_back_attempts (owner_id, created_at desc);

alter table public.teach_back_attempts enable row level security;
create policy teach_back_select on public.teach_back_attempts for select to authenticated using (owner_id = (select auth.uid()));
create policy teach_back_delete on public.teach_back_attempts for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.teach_back_attempts from anon, authenticated;
grant select, delete on public.teach_back_attempts to authenticated;
grant all on public.teach_back_attempts to service_role;
