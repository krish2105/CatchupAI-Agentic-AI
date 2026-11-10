-- Agent team: what each student knows about each concept of a lecture (Diagnostician and Quizmaster).
-- Server-owned like quiz attempts: students read (and may delete) their own rows; only the server writes,
-- so mastery can't be forged through the public API. Answer keys live apart and are never readable by students.

create table public.concept_mastery (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  concept text not null check (char_length(concept) between 1 and 120),
  page integer not null check (page >= 1),
  quote text not null check (char_length(quote) between 1 and 1200),
  rating real not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0),
  last_confident_wrong boolean not null default false,
  status text not null default 'untested' check (status in ('known', 'shaky', 'not_yet', 'confidently_wrong', 'untested')),
  updated_at timestamptz not null default now(),
  unique (owner_id, document_id, concept),
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete cascade
);
create index concept_mastery_owner_doc_idx on public.concept_mastery (owner_id, document_id);

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  session_id uuid not null,
  mode text not null check (mode in ('diagnostic', 'practice', 'rehearsal')),
  position integer not null check (position >= 0),
  concept text not null check (char_length(concept) between 1 and 120),
  page integer not null check (page >= 1),
  prompt text not null check (char_length(prompt) between 1 and 600),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  difficulty real not null default 0,
  source text not null check (source in ('agent', 'cloze')),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 10 and 600),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete cascade
);
create index assessment_items_session_idx on public.assessment_items (owner_id, session_id, position);

-- Answer key, hint and source quote: server only (no policies, no grants for students).
create table public.assessment_keys (
  item_id uuid primary key,
  owner_id uuid not null,
  answer_index integer not null check (answer_index between 0 and 3),
  hint text not null check (char_length(hint) between 1 and 400),
  quote text not null check (char_length(quote) between 1 and 1200),
  foreign key (item_id, owner_id) references public.assessment_items (id, owner_id) on delete cascade
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null,
  chosen integer check (chosen is null or chosen between 0 and 3),
  correct boolean not null,
  confidence text not null check (confidence in ('sure', 'think', 'guess')),
  elapsed_ms integer not null default 0 check (elapsed_ms >= 0),
  hints_used integer not null default 0 check (hints_used between 0 and 2),
  timed_out boolean not null default false,
  created_at timestamptz not null default now(),
  unique (item_id),
  foreign key (item_id, owner_id) references public.assessment_items (id, owner_id) on delete cascade
);
create index assessment_attempts_owner_idx on public.assessment_attempts (owner_id, created_at desc);

-- Hints taken before answering (server-recorded, so the attempt row can carry hints_used).
create table public.assessment_hints (
  item_id uuid not null,
  owner_id uuid not null,
  level integer not null check (level between 1 and 2),
  created_at timestamptz not null default now(),
  primary key (item_id, level),
  foreign key (item_id, owner_id) references public.assessment_items (id, owner_id) on delete cascade
);

alter table public.concept_mastery enable row level security;
alter table public.assessment_items enable row level security;
alter table public.assessment_keys enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_hints enable row level security;

create policy concept_mastery_select on public.concept_mastery for select to authenticated using (owner_id = (select auth.uid()));
create policy concept_mastery_delete on public.concept_mastery for delete to authenticated using (owner_id = (select auth.uid()));
create policy assessment_items_select on public.assessment_items for select to authenticated using (owner_id = (select auth.uid()));
create policy assessment_attempts_select on public.assessment_attempts for select to authenticated using (owner_id = (select auth.uid()));
create policy assessment_hints_select on public.assessment_hints for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.concept_mastery, public.assessment_items, public.assessment_keys, public.assessment_attempts, public.assessment_hints from anon, authenticated;
grant select, delete on public.concept_mastery to authenticated;
grant select on public.assessment_items, public.assessment_attempts, public.assessment_hints to authenticated;
grant all on public.concept_mastery, public.assessment_items, public.assessment_keys, public.assessment_attempts, public.assessment_hints to service_role;

-- Which agent of the team did a run (the copilot is the Coach).
alter table public.agent_runs add column agent text not null default 'coach'
  check (agent in ('coach', 'diagnostician', 'quizmaster', 'night_coach'));
