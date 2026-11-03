# 02 — Technical Architecture and Sequence

## High level

```text
Student browser (Next.js/React UI + progressive R3F hero)
       | HTTPS / cookie session
       v
Next.js App Router + Route Handlers
       |-- Auth/session verification + Zod + rate/cost limits
       |-- Course / assignment / task service
       |-- Document ingest + text extraction + embedding pipeline
       |-- LearningRecoveryAgent (Agents SDK)
       |       |-- read-only authorized tools
       |       |-- prepare proposal tools (no direct writes)
       |       '-- agent run/event log
       |-- Deterministic scheduling / feasibility service
       '-- Atomic approval service
       |                        |
       v                        v
Supabase Auth+Postgres       OpenAI API
Private Storage + pgvector  agent model + embeddings
```

## Core design principles
- **One Next.js deployable** to minimize hackathon infra. Server-only modules for AI tools, DB access, RAG and planner; minimal trust surface.
- **Single agent first**, no independent agents for every task. Deterministic calculations in service functions; the model recommends and explains.
- **Always fetch user identity server-side** from the current verified session. Never accept `user_id` supplied by a browser/model as an authorization source.
- **RLS + route ownership checks + private Storage** provide defense in depth; no service-role key in the browser or general-purpose agent tool.
- **Readable state machine:** docs `uploaded -> processing -> ready|failed`; agent runs `queued|running -> completed|failed`; proposals `pending -> approved|rejected|expired`; tasks `todo|in_progress|completed`.
- **Real results only:** don't claim 'searched notes' unless an authorized retrieval tool executed and returned results.

## Document workflow
1. Authenticated UI requests an upload session; backend verifies file type, size and course ownership.
2. Browser uploads to a student-scoped path in a private bucket using Supabase Storage with appropriate authorization/signed URL controls.
3. Backend records pending document; a bounded processor extracts page text (no OCR initially), chunks it and embeds the text; deduplicate retries and persist idempotently.
4. Store each chunk with document ID, page(s), course ID and `vector(1536)`. Mark `ready` only after successful processing.
5. A search tool queries vector similarity with an **authorized user+course constraint**; only the resulting actual pages may be cited.
6. Large documents or execution timeouts must fail visibly and be retryable. Consider a queued worker only if needed based on measured duration.

## Agent request workflow
1. `POST /api/agent/run` verifies cookie-auth, enforces request/schema limits and creates `agent_runs` record.
2. Agent receives explicit scope: student user ID *as trusted runtime context*, selected course and tool constraints. Never embed API secrets in prompts.
3. Agent chooses read-only tools (assignments, notes, progress); tools validate scope against authenticated identity.
4. Agent proposes a plan via type-safe data; backend runs feasibility and validation rules.
5. Backend stores pending proposal and returns summary, source citations, true tool activity and proposal ID.
6. User approves/rejects via a separate API. Approval transaction checks that proposal belongs to user, is pending and not expired, then creates tasks exactly once.

## Deployment
- Vercel for Next.js API+UI; Supabase managed DB/Auth/Storage.
- Confirm function limits before adopting PDF ingestion method; client-to-Storage transfers prevent request-body issues.
- Separate preview/staging and production environment variables if time allows.
- `.env.local` must be git-ignored, production secrets entered through hosting dashboard.
- Use exact deployment URLs only after verified. No static demo credentials printed publicly.

## Failure modes
- OpenAI outage -> honest error, retry control, no fake output.
- Vector retrieval empty -> ask user to upload relevant material; don't hallucinate citation.
- Duplicate upload -> recognize file identity and avoid duplicate chunks.
- Approval race -> transactional status check and unique constraint/idempotency key.
- Cross-user reference -> 403/404 with no details leaked.
- No WebGL/reduced motion -> static orb and fully usable main UI.
