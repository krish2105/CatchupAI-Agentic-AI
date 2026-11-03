-- CatchUp AI initial schema — REVIEW and TEST against your Supabase project before running.
-- This is a starting migration, not a verified production migration.
-- System-owned table writes should go through trusted server services after verified auth.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
set search_path = public, extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  daily_study_minutes integer not null default 60 check (daily_study_minutes between 0 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  unique(id, owner_id)
);
create index if not exists idx_courses_owner on public.courses(owner_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  sha256 text,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded','processing','ready','failed')),
  error_code text,
  page_count integer check (page_count is null or page_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_documents_course on public.documents(course_id);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer not null check (page_start >= 1),
  page_end integer not null check (page_end >= page_start),
  content text not null check (char_length(content) > 0),
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);
create index if not exists idx_chunks_document on public.document_chunks(document_id);
-- Add HNSW vector index after validating dataset size and operator extension schema.
create index if not exists idx_chunks_embedding_hnsw
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_at timestamptz not null,
  estimated_minutes integer not null default 60 check (estimated_minutes between 1 and 10080),
  status text not null default 'todo' check (status in ('todo','in_progress','completed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_assignments_course_due on public.assignments(course_id,due_at);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'approved' check (status in ('approved','archived')),
  feasibility_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_plans_owner on public.study_plans(owner_id);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  status text not null default 'todo' check (status in ('todo','in_progress','completed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_plan on public.study_tasks(plan_id);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  topic text not null,
  questions_json jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  summary text,
  tool_events jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_runs_owner_created on public.agent_runs(owner_id,created_at desc);

create table if not exists public.action_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  proposal_json jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  expires_at timestamptz not null,
  applied_plan_id uuid unique references public.study_plans(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique(owner_id,idempotency_key)
);
create index if not exists idx_proposals_owner_status on public.action_proposals(owner_id,status);

-- RLS must be enabled before exposing anything to authenticated browsers.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.assignments enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.agent_runs enable row level security;
alter table public.action_proposals enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy courses_all on public.courses for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy documents_select on public.documents for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));
create policy documents_insert on public.documents for insert to authenticated
  with check (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));
-- Document processing states and chunks are server-owned; no direct browser UPDATE permission policies.
create policy chunks_select on public.document_chunks for select to authenticated
  using (exists (
    select 1 from public.documents d join public.courses c on c.id = d.course_id
    where d.id = document_id and c.owner_id = (select auth.uid())
  ));

create policy assignments_all on public.assignments for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));

create policy plans_select on public.study_plans for select to authenticated
  using (owner_id = (select auth.uid()));
create policy tasks_select on public.study_tasks for select to authenticated
  using (exists (select 1 from public.study_plans p where p.id = plan_id and p.owner_id = (select auth.uid())));
create policy quizzes_select on public.quizzes for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));
create policy attempts_select on public.quiz_attempts for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = quiz_id and c.owner_id = (select auth.uid())
  ));
create policy runs_select on public.agent_runs for select to authenticated
  using (owner_id = (select auth.uid()));
create policy proposals_select on public.action_proposals for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.agent_runs r where r.id = run_id and r.owner_id = (select auth.uid())
  ));

-- Vector retrieval is an INVOKER function so the underlying chunk/doc/course RLS applies.
create or replace function public.match_document_chunks(
  p_course_id uuid,
  p_query_embedding vector(1536),
  p_limit integer default 6
)
returns table (
  chunk_id uuid,
  document_id uuid,
  page_start integer,
  page_end integer,
  content text,
  similarity double precision
)
language sql stable security invoker
set search_path = public, extensions
as $$
  select dc.id, dc.document_id, dc.page_start, dc.page_end, dc.content,
         (1 - (dc.embedding <=> p_query_embedding))::double precision as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  join public.courses c on c.id = d.course_id
  where d.course_id = p_course_id
    and c.owner_id = (select auth.uid())
    and d.processing_status = 'ready'
  order by dc.embedding <=> p_query_embedding
  limit least(greatest(coalesce(p_limit,6),1),6);
$$;
revoke all on function public.match_document_chunks(uuid,vector,integer) from public;
grant execute on function public.match_document_chunks(uuid,vector,integer) to authenticated;

-- Make the bucket private. Review storage policies and expected permissions before use.
insert into storage.buckets (id,name,public)
values ('course-documents','course-documents',false)
on conflict (id) do nothing;

create policy "student_read_own_pdf" on storage.objects for select to authenticated
using (bucket_id = 'course-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "student_upload_own_pdf" on storage.objects for insert to authenticated
with check (bucket_id = 'course-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Work TODO: secure proposal approval RPC/transaction, proper system-owned write grants,
-- validation triggers for invariant statuses, storage deletion cleanup, and seeded integration tests.
