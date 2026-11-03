# 04 — Database, Data Ownership and RLS

## Schema overview
An initial **review-required migration** is included at `supabase/migrations/0001_initial.sql`. Before deployment, review compatibility with the exact Supabase/Postgres environment, then run it in a clean development project and test all policies. Do not blindly paste production SQL.

Entities:
- `profiles`: one per `auth.users` user, timezone and study-time preferences.
- `courses`: student-owned course.
- `documents`: metadata for private PDF upload, processing state, object key.
- `document_chunks`: searchable content, page number and 1536-dimensional embedding.
- `assignments`: student-owned via course; due date, effort, state.
- `study_plans`: draft/approved study plan.
- `study_tasks`: scheduled tasks attached to a plan.
- `quizzes`, `quiz_attempts`: P1 assessment material/answers.
- `agent_runs`: outcome + metadata; avoid raw sensitive model traces.
- `action_proposals`: pending explicit user approvals with expiration.

## Access model
- App identity originates from verified Supabase SSR auth, not request input.
- `courses.owner_id = auth.uid()` is the root authorization condition.
- Child tables authorize through their parent course or plan ownership, e.g. chunks -> document -> course -> owner.
- `profiles.id = auth.uid()`.
- `study_plans.owner_id = auth.uid()`; tasks -> plan.
- Agent runs/proposals owned by user, and proposed action payloads revalidated server-side on approval.
- Prevent user-assignable `owner_id` from being used for privilege escalation; insert policies restrict it.
- Storage bucket must be private, with object keys prefixed by verified user ID. Define and test `storage.objects` access policies. A signed URL has a limited lifetime.

## SQL safety
- Use UTC `timestamptz` in DB, display in profile's IANA timezone.
- Constraints validate state strings, nonnegative durations, unique approval execution and referential integrity.
- Index typical lookup columns and vector column with an appropriate operator class.
- Vector matching function must use `SECURITY INVOKER`, and ensure current auth RLS is applied. Do not expose a bypass-RLS `SECURITY DEFINER` search API.
- Use atomic DB transaction for `approve proposal + insert tasks + flip status`, with retries and a uniqueness/idempotency guard.

## Revalidation tests
1. User A cannot read or mutate B's courses, documents, chunks, plans, tasks, proposals.
2. User A cannot retrieve B's embedding content using vector search.
3. User A cannot access B's private Storage object through a guessed path.
4. Inserting a document for another user's course fails.
5. Two concurrent approvals create tasks only once.
6. Deleted course cleanup respects FKs and storage cleanup policy.
7. Invalid study duration/status rejected at DB layer.
