-- CatchUp AI core schema.
--
-- Tenancy model: every user-owned row carries owner_id. Child tables reference their parent through a
-- composite (id, owner_id) foreign key, so a row can never point at another student's course/plan/document
-- even if a policy were wrong. RLS is then a simple owner_id = auth.uid() check, and column-level grants
-- restrict which fields the browser-facing `authenticated` role may write. Server-owned tables (chunks,
-- agent runs, proposals, plans, quizzes) are SELECT-only for `authenticated`; writes happen through
-- trusted server code or SECURITY DEFINER functions that re-check auth.uid().

create extension if not exists vector with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  -- Study minutes available per ISO weekday, Monday first.
  weekly_minutes integer[] not null default '{60,60,60,60,60,0,0}'
    check (cardinality(weekly_minutes) = 7 and array_position(weekly_minutes, null) is null
           and 0 <= all (weekly_minutes) and 720 >= all (weekly_minutes)),
  -- Local wall-clock time when daily study blocks begin.
  study_start_time time not null default '18:00',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Raises invalid_parameter_value for unknown IANA zones.
  perform now() at time zone new.timezone;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.validate_profile();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Courses and assignments
-- ---------------------------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index courses_owner_idx on public.courses (owner_id, created_at);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  course_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  due_at timestamptz not null,
  estimated_minutes integer not null default 60 check (estimated_minutes between 5 and 10080),
  -- Required work is always included in every recovery scenario.
  required boolean not null default true,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade
);
create index assignments_owner_due_idx on public.assignments (owner_id, due_at);
create index assignments_course_idx on public.assignments (course_id);
create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Documents and retrieval chunks
-- ---------------------------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  course_id uuid not null,
  filename text not null check (char_length(filename) between 1 and 200),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  -- Server-derived object key; never client supplied.
  storage_path text generated always as (owner_id::text || '/' || course_id::text || '/' || id::text || '.pdf') stored,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error_code text check (error_code is null or char_length(error_code) <= 64),
  page_count integer check (page_count is null or page_count >= 0),
  chunk_count integer check (chunk_count is null or chunk_count >= 0),
  embedding_model text,
  processing_started_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade
);
create index documents_course_idx on public.documents (course_id, created_at);
create index documents_owner_idx on public.documents (owner_id);
-- One copy of identical content per course.
create unique index documents_course_sha_uidx on public.documents (course_id, sha256) where sha256 is not null;
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  course_id uuid not null,
  document_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer not null check (page_start >= 1),
  page_end integer not null check (page_end >= page_start),
  content text not null check (char_length(content) between 1 and 8000),
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete cascade,
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade
);
create index chunks_owner_course_idx on public.document_chunks (owner_id, course_id);
create index chunks_tsv_idx on public.document_chunks using gin (content_tsv);
create index chunks_embedding_idx on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------------------------
-- Agent runs and action proposals (server-written, student-readable)
-- ---------------------------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  request_text text not null check (char_length(request_text) between 1 and 2000),
  summary text,
  tool_events jsonb not null default '[]'::jsonb check (jsonb_typeof(tool_events) = 'array'),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  model text,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, owner_id),
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete set null (course_id)
);
create index agent_runs_owner_idx on public.agent_runs (owner_id, created_at desc);

create table public.action_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid,
  kind text not null default 'recovery_plan' check (kind in ('recovery_plan')),
  scenario text not null check (scenario in ('essential', 'balanced', 'full')),
  schema_version integer not null default 1,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  -- Hash of the inputs (assignments, availability, active tasks) the plan was computed from.
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  feasible boolean not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  approval_key text check (approval_key is null or char_length(approval_key) between 8 and 128),
  applied_plan_id uuid unique,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (run_id, owner_id) references public.agent_runs (id, owner_id) on delete set null (run_id)
);
create index proposals_owner_status_idx on public.action_proposals (owner_id, status, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Approved plans and tasks
-- ---------------------------------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid not null unique,
  title text not null check (char_length(title) between 1 and 160),
  scenario text not null check (scenario in ('essential', 'balanced', 'full')),
  status text not null default 'active' check (status in ('active', 'superseded')),
  feasibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (id, owner_id),
  foreign key (proposal_id, owner_id) references public.action_proposals (id, owner_id) on delete cascade
);
create index plans_owner_idx on public.study_plans (owner_id, created_at desc);
-- At most one active plan per student.
create unique index plans_one_active_uidx on public.study_plans (owner_id) where status = 'active';

alter table public.action_proposals
  add constraint proposals_applied_plan_fk foreign key (applied_plan_id) references public.study_plans (id) on delete set null;

create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null,
  course_id uuid not null,
  assignment_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null check (kind in ('assignment', 'study', 'review')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer generated always as ((extract(epoch from (ends_at - starts_at)) / 60)::integer) stored,
  position integer not null check (position >= 0),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  status text not null default 'todo' check (status in ('todo', 'completed', 'cancelled')),
  -- True while the owning plan is active; superseded plans' tasks drop out of the overlap rule.
  active boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours'),
  foreign key (plan_id, owner_id) references public.study_plans (id, owner_id) on delete cascade,
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade,
  foreign key (assignment_id, owner_id) references public.assignments (id, owner_id) on delete set null (assignment_id),
  -- No two active tasks of one student may overlap in time.
  constraint study_tasks_no_overlap exclude using gist (owner_id with =, tstzrange(starts_at, ends_at) with &&) where (active)
);
create index tasks_plan_idx on public.study_tasks (plan_id, position);
create index tasks_owner_start_idx on public.study_tasks (owner_id, starts_at);

create or replace function public.stamp_task_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and current_user = 'authenticated' then
    raise exception 'students cannot cancel tasks directly' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger study_tasks_completion before update on public.study_tasks
  for each row execute function public.stamp_task_completion();

-- ---------------------------------------------------------------------------------------------
-- Quizzes (P1)
-- ---------------------------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  course_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  topic text not null check (char_length(topic) between 1 and 160),
  -- Questions with options and evidence; answer keys are never sent to the browser before grading.
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  run_id uuid,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (course_id, owner_id) references public.courses (id, owner_id) on delete cascade
);
create index quizzes_owner_idx on public.quizzes (owner_id, created_at desc);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  quiz_id uuid not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  score_percent numeric(5, 2) not null check (score_percent between 0 and 100),
  created_at timestamptz not null default now(),
  foreign key (quiz_id, owner_id) references public.quizzes (id, owner_id) on delete cascade
);
create index quiz_attempts_owner_idx on public.quiz_attempts (owner_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Per-user rate limiting (fixed windows), usable from serverless handlers
-- ---------------------------------------------------------------------------------------------
create table public.rate_limit_counters (
  owner_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 64),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (owner_id, bucket, window_start)
);

create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_hits integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_counters as c (owner_id, bucket, window_start, hits)
  values (v_uid, p_bucket, v_window, 1)
  on conflict (owner_id, bucket, window_start) do update set hits = c.hits + 1
  returning hits into v_hits;
  delete from public.rate_limit_counters
   where owner_id = v_uid and bucket = p_bucket and window_start < v_window - make_interval(secs => p_window_seconds);
  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.assignments enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.action_proposals enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.rate_limit_counters enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy courses_select on public.courses for select to authenticated using (owner_id = (select auth.uid()));
create policy courses_insert on public.courses for insert to authenticated with check (owner_id = (select auth.uid()));
create policy courses_update on public.courses for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy courses_delete on public.courses for delete to authenticated using (owner_id = (select auth.uid()));

create policy assignments_select on public.assignments for select to authenticated using (owner_id = (select auth.uid()));
create policy assignments_insert on public.assignments for insert to authenticated with check (owner_id = (select auth.uid()));
create policy assignments_update on public.assignments for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy assignments_delete on public.assignments for delete to authenticated using (owner_id = (select auth.uid()));

create policy documents_select on public.documents for select to authenticated using (owner_id = (select auth.uid()));
create policy documents_insert on public.documents for insert to authenticated with check (owner_id = (select auth.uid()));
create policy documents_delete on public.documents for delete to authenticated using (owner_id = (select auth.uid()));

create policy chunks_select on public.document_chunks for select to authenticated using (owner_id = (select auth.uid()));
create policy agent_runs_select on public.agent_runs for select to authenticated using (owner_id = (select auth.uid()));
create policy proposals_select on public.action_proposals for select to authenticated using (owner_id = (select auth.uid()));
create policy plans_select on public.study_plans for select to authenticated using (owner_id = (select auth.uid()));
create policy tasks_select on public.study_tasks for select to authenticated using (owner_id = (select auth.uid()));
create policy tasks_update on public.study_tasks for update to authenticated
  using (owner_id = (select auth.uid()) and active) with check (owner_id = (select auth.uid()));
create policy quizzes_select on public.quizzes for select to authenticated using (owner_id = (select auth.uid()));
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated using (owner_id = (select auth.uid()));
-- rate_limit_counters: no policies (only the SECURITY DEFINER function touches it).

-- ---------------------------------------------------------------------------------------------
-- Grants: deny by default, then allow exactly what the browser-facing role needs.
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, timezone, weekly_minutes, study_start_time, onboarded_at) on public.profiles to authenticated;

grant select, delete on public.courses to authenticated;
grant insert (title, description) on public.courses to authenticated;
grant update (title, description) on public.courses to authenticated;

grant select, delete on public.assignments to authenticated;
grant insert (course_id, title, notes, due_at, estimated_minutes, required, status) on public.assignments to authenticated;
grant update (title, notes, due_at, estimated_minutes, required, status) on public.assignments to authenticated;

grant select, delete on public.documents to authenticated;
grant insert (course_id, filename, size_bytes) on public.documents to authenticated;

grant select on public.document_chunks, public.agent_runs, public.action_proposals,
  public.study_plans, public.quizzes, public.quiz_attempts to authenticated;
grant select on public.study_tasks to authenticated;
grant update (status) on public.study_tasks to authenticated;

grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------------------------
-- Private storage for course PDFs
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-documents', 'course-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read/delete only inside your own top-level folder.
create policy course_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'course-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy course_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'course-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Upload only to the exact path of a document row you own that is still awaiting its file.
create policy course_docs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = name and d.owner_id = (select auth.uid()) and d.status = 'uploaded'
    )
  );
