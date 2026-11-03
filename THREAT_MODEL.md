# Threat model · CatchUp AI

## Assets
Student identity and session · course documents (PDFs, extracted text, embeddings) · assignments, schedules, approved plans · quiz answer keys and attempts · teach-back explanations · agent traces · operator secrets (Supabase secret key, OpenAI key, cron secret) · operator spend (OpenAI, storage).

## Actors
Signed-in student · anonymous demo visitor · another student (curious or malicious) · unauthenticated internet client · malicious document author (indirect prompt injection) · the LLM (untrusted decision support) · scheduler (cron).

## Trust boundaries
1. **Browser → Next.js** (`src/proxy.ts`, route handlers): session cookie verified with `getClaims()`; Origin check on writes; CSP on pages.
2. **Next.js → Supabase as the student** (publishable key + user JWT): PostgREST and Storage enforce RLS, column grants and policies.
3. **Next.js → Supabase as admin** (`server-only` secret key): used only after an ownership check, for server-owned writes (ingestion chunks, proposals, quiz keys/attempts, teach-back attempts, demo seed, account deletion, cron).
4. **Next.js → OpenAI**: model sees the student's request and retrieved passages; tools run server-side with trusted context.
5. **Uploaded PDF → pipeline**: untrusted bytes and text.
6. **Scheduler → cron route**: bearer secret.

## Attack paths and controls

| Path | Control | Verified by |
| --- | --- | --- |
| Read/modify another student's rows by ID (BOLA) | RLS + composite FKs; ownership lookups before admin writes | `rls.test.ts`, `checklist.test.ts`, E2E 404s |
| Forge `owner_id`, scores or plans via the public API | column grants; server-owned tables SELECT-only | `rls.test.ts`, `teach.test.ts`, `quiz.test.ts` |
| Fetch another student's file or signed link | per-user Storage folders; links issued after RLS lookup, 120 s | `rls.test.ts` storage |
| Retrieve another student's passages through RAG or the agent | `search_course_chunks` is invoker + owner filter; tools re-check course ownership | `agent.test.ts`, eval X-cases |
| Indirect prompt injection in a PDF | passages are data in the prompt; only read/draft tools exist; drafts need human approval; unsupported facts dropped | `rag.test.ts`, eval |
| Replay or race an approval | `approve_proposal` row lock, idempotency key, staleness hash, expiry | `approval.test.ts` (10 concurrent) |
| CSRF on state-changing routes | SameSite=Lax cookies + Origin check | `security.spec.ts` |
| XSS → data theft | React escaping + nonce CSP + `frame-ancestors 'none'` | `security.spec.ts` |
| Cost exhaustion (AI, uploads) | per-student DB rate limits; smaller demo budgets; Turnstile; OpenAI project limit | `abuse.test.ts` |
| Storage/DB bloat via RPC | rate-limit allowlist; upload size/page limits | `abuse.test.ts`, `rag.test.ts` |
| Malicious/pathological PDF | magic bytes, 10 MB, 50 pages, encrypted/no-text rejection, bounded processing | `rag.test.ts`, `documents.spec.ts` |
| Open redirect after login | same-origin relative `next` only | E2E auth tests |
| Stolen cron secret / timing | ≥32-char secret, constant-time compare | E2E cron test |
| Secret leakage to client | `server-only` imports, bundle scan in CI | CI |

## Out of scope / not covered
Production infrastructure (Supabase/Vercel account security, backups), DDoS at the edge, social engineering, physical device security, and live-LLM jailbreak behaviour (no API key during this audit).
