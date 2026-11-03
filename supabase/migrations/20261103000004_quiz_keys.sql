-- Answer keys live apart from the student-readable quizzes table so they cannot be read before grading.
-- No RLS policies and no grants for anon/authenticated: only trusted server code (service role) can access.
create table public.quiz_keys (
  quiz_id uuid primary key,
  owner_id uuid not null,
  keys jsonb not null check (jsonb_typeof(keys) = 'array'),
  created_at timestamptz not null default now(),
  foreign key (quiz_id, owner_id) references public.quizzes (id, owner_id) on delete cascade
);
alter table public.quiz_keys enable row level security;
revoke all on public.quiz_keys from anon, authenticated;
grant all on public.quiz_keys to service_role;

alter table public.quizzes add column method text not null default 'cloze' check (method in ('cloze'));
