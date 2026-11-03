# 05 — Backend API Contract (proposed)

All `/api/*` endpoints except health require verified session cookies, Zod request validation, ownership authorization, appropriate throttling and consistent error bodies. `health` must never reveal secrets or database credentials. These are **target contracts**, not APIs currently implemented by the visual starter.

## Endpoints

| Method | Route | P | Contract |
|---|---|---|---|
| GET | `/api/health` | Starter | Server reachable JSON; **already present** |
| GET / POST | `/api/courses` | P0 | List/create owned courses |
| PATCH / DELETE | `/api/courses/:id` | P0 | Edit/delete only own course |
| GET / POST | `/api/assignments` | P0 | Query/add due dates for owned courses |
| PATCH | `/api/assignments/:id` | P0 | Update status/effort |
| POST | `/api/uploads/sign` | P0 | Validate file metadata, give scoped signed upload info |
| POST | `/api/documents/:id/process` | P0 | Authorize processing/retry, idempotent ingest |
| GET | `/api/documents/:id` | P0 | Get state/metadata, verified source link |
| POST | `/api/agent/run` | P0 | Authenticated agent request, execute read tools and draft proposals |
| GET | `/api/agent/runs/:id` | P0 | Only own activity timeline/results |
| GET | `/api/proposals/:id` | P0 | Inspect an authorized proposal |
| POST | `/api/proposals/:id/approve` | P0 | Atomic/idempotent task creation after validation |
| POST | `/api/proposals/:id/reject` | P0 | Reject without side effects |
| GET / PATCH | `/api/study-tasks` | P0 | Read/update only own tasks |
| POST | `/api/quizzes/generate` | P1 | Source-grounded quiz generation |
| POST | `/api/quizzes/:id/submit` | P1 | Grade authorized attempt, record weak topics |
| GET | `/api/progress` | P1 | Actual progress metrics only |

## Example: run agent

Request:

```json
{ "courseId": "uuid", "message": "I missed Module 4; plan before Friday." }
```

Response after tool execution:

```json
{
  "runId": "uuid",
  "status": "approval_required",
  "summary": "A 2-day plan is ready, but 1.5 hours do not fit.",
  "citationRefs": [{ "documentId": "uuid", "page": 4, "chunkId": "uuid" }],
  "toolEvents": [
    { "tool": "list_assignments", "status": "completed" },
    { "tool": "search_course_material", "status": "completed" }
  ],
  "proposalId": "uuid"
}
```

Do not expose raw vector embeddings, arbitrary database identifiers for unauthorized documents, hidden prompts or secrets. No invented citations or toolEvents.

## Example: approval

```text
POST /api/proposals/:id/approve
Idempotency-Key: opaque-client-generated-token
```

Success includes persisted `planId` and created `taskIds`. Duplicate call returns the **same persisted result** (or an explicit already-approved status), not new task rows. Unauthorized -> 404/403; invalid schema -> 400; expired/conflicted -> 409; rate limit -> 429; OpenAI unavailable -> 503; internal error -> 500 with correlation ID and no stack trace in client.

## API organization
- Authenticated request helpers (`getUserOrThrow`)
- Zod schemas under `src/lib/validation`
- Data repository with ownership-safe queries
- Independent agent tool implementations with injected verified user context
- Centralized errors/logging and cost throttling
