# Security audit · CatchUp AI

**Date:** 2026-11-04 · **Scope:** this repository (Next.js 16 app, 36 route handlers, `src/proxy.ts`, 9 Supabase migrations, Storage policies, agent tools, RAG pipeline, CI). **Method:** code and migration review, dependency audit, bundle scan, and automated negative tests against the local stack. No external or production systems were tested.

## Summary
No Critical findings. One High (cost abuse through demo accounts) and three Medium findings were confirmed and fixed, each with a regression test. Remaining items are configuration a deployer must complete (Turnstile, OpenAI spend limit, SMTP) and accepted low risks, listed below.

## Findings

| ID | Sev. | Location | Evidence | Exploit scenario / impact | Fix | Regression test |
| --- | --- | --- | --- | --- | --- | --- |
| H-1 | High | `src/lib/http/rate-limit.ts`, AI/upload/quiz routes | Anonymous accounts had the same quotas as full accounts (30 AI runs/day, 20 uploads/h). Supabase allows 30 anonymous sign-ins/h per IP (`supabase/config.toml`). | A script creates anonymous accounts and spends ~900 AI runs/h per IP on the operator's OpenAI key. | Separate demo budgets: AI 5/day, uploads 6/h, checks 10/day, teach-back 20/day (`DEMO_LIMITS`), applied to every costly route. Deployers must also enable Turnstile and set an OpenAI project limit (docs/DEPLOYMENT.md). | `tests/integration/abuse.test.ts` (6th demo AI call → 429; full account unaffected) |
| M-1 | Medium | all pages | No `Content-Security-Policy` header. | Any future XSS bug could run arbitrary script and read student data. | Per-request nonce CSP in `src/proxy.ts`: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`, connect limited to self, Supabase and Turnstile. The theme script carries the nonce. | `tests/e2e/security.spec.ts` (12 pages: header shape, no un-nonced inline scripts, zero CSP violations) |
| M-2 | Medium | `consume_rate_limit` (SECURITY DEFINER) | Callable by any signed-in student via PostgREST with any bucket name and window. | Unbounded counter rows (table bloat / storage DoS). | Migration `20261104000009`: bucket allowlist with fixed windows, limit ≤ 1000, execute revoked from `anon`/`public`. | `tests/integration/abuse.test.ts`; `tests/unit/rate-limit-sync.test.ts` (app buckets match the SQL allowlist) |
| M-3 | Medium | `GET /api/recovery`, `POST /api/account/delete` | No rate limit; recovery recompute runs retrieval per course plus the scheduler. | Authenticated resource exhaustion. | `compute` (300/h) and `account` (5/h) limits. | covered by the bucket-sync test; routes exercised in E2E |
| L-1 | Low | state-changing routes | No Origin check (session cookies are `SameSite=Lax`, which already blocks cross-site POSTs). | Defence in depth against CSRF. | `src/proxy.ts` rejects non-GET requests whose `Origin` is another site (403 `forbidden_origin`). | `tests/e2e/security.spec.ts` |
| L-2 | Low | `GET /api/cron/cleanup-demo` | Secret compared with `!==`; no minimum length. | Timing side channel; weak secrets. | `timingSafeEqual`, secret ≥ 32 characters. | `tests/e2e/redesign.spec.ts` (refuses without secret) |
| L-3 | Low | `GET /api/health` | Returned stale fields (`product: "CatchUp AI starter"`, `backendConnected: false`). | Misleading monitoring / information exposure. | Returns only `{"status":"ok"}`, `no-store`. | `tests/e2e/security.spec.ts` |
| L-4 | Low | `next.config.ts` | No HSTS from the app (platform-dependent). | Downgrade on custom domains. | `Strict-Transport-Security: max-age=63072000; includeSubDomains`. | `tests/e2e/security.spec.ts` |
| L-5 | Low | dev dependencies | `npm audit`: 16 moderate (eslint / minimatch ReDoS). Production dependencies: 0. | Lint tooling only; not shipped. | **Accepted.** CI fails on high+ production advisories. | CI `npm audit --omit=dev --audit-level=high` |
| L-6 | Low | repository | No CI pipeline. | Regressions could reach `main` unnoticed. | `.github/workflows/ci.yml`: typecheck, lint, unit, prod audit, build, bundle secret scan, then integration + E2E + eval against a local Supabase. | CI run |

Fixed earlier in this build (recorded in BUILD_STATUS): rejected/rotated session tokens now recover instead of erroring (PGRST301–303 → 401 → `/auth/refresh`), open redirect in `/auth/confirm` blocked, demo sign-out moved from GET to POST.

## Verified secure (with evidence)
- **Tenant isolation:** every student table has RLS (`owner_id = auth.uid()`), composite `(id, owner_id)` foreign keys, and per-operation policies; server-owned tables (agent runs, proposals, plans, tasks, quiz keys/attempts, teach-back attempts, chunks) are SELECT-only for students. *Tests:* `rls.test.ts` (24), `checklist.test.ts`, `teach.test.ts`, `quiz.test.ts`, E2E direct-URL 404s.
- **Storage:** private bucket, 10 MB / PDF-only limits, per-user folder policies, signed source links valid 120 s and issued only after an RLS ownership lookup. *Tests:* `rls.test.ts` "private storage".
- **SECURITY DEFINER functions** (`approve_proposal`, `reject_proposal`, `handle_new_user`, `consume_rate_limit`) pin `search_path = ''` and re-check `auth.uid()`; `search_course_chunks` is SECURITY INVOKER.
- **Approval state machine:** pending → approved/rejected/expired; approval is idempotent (10 concurrent requests → 1 plan), stale inputs and expired drafts are refused, another student can't approve. *Tests:* `approval.test.ts`, E2E double-click.
- **Agent:** five read-or-draft tools at the time of this audit (seven since sprint 2: plus `get_student_memory` and `suggest_memory`, which only suggests), Zod-typed arguments, trusted user/course context, budgets (turns, searches, message size, daily runs, timeout), facts without retrieved sources are dropped, failures expire drafts. *Tests:* `agent.test.ts`, eval X1–X4.
- **RAG:** PDF magic bytes, size/page limits, encrypted/scanned/truncated rejected, retrieval scoped by RLS and owner filter, abstention below evidence threshold, injected instructions stored as inert text. *Tests:* `rag.test.ts`, `documents.spec.ts`, eval R1–R8.
- **Secrets:** server keys only in `server-only` modules; `.env*` ignored; no key material in tracked files or the client bundle (scan in CI).
- **Errors:** uniform JSON errors; database messages and stacks are never returned (logged server-side only).

## Accepted / residual risks
- `style-src 'unsafe-inline'` (inline style attributes throughout the UI); scripts remain nonce-only.
- Signed source links are bearer URLs for 120 s.
- No global (cross-user) spend cap in the app: rely on the OpenAI project's monthly limit.
- Anonymous sign-in remains enabled for the demo, now behind Turnstile CAPTCHA (enabled in production 2026-11-04) plus the smaller demo budgets.

## M8 delta review (2026-11-04)
**Scope:** surfaces added in sprint 2 (study emails, unsubscribe, feedback, copilot memory, MCP server and tokens, quality page, readiness check) and the agent and RAG answer path, reviewed against the relevant OWASP ASVS 5.0 areas (V1 encoding, V4 access control, V6 authentication, V8 authorization, V11 cryptography, V16 logging). No Critical findings.

| ID | Sev. | Location | Finding | Fix | Regression test |
| --- | --- | --- | --- | --- | --- |
| H-2 | High | agent answer path | Injected text in a student PDF could be shown as a cited **fact** ("the plan was approved and saved"), because the source-id check passed | Retrieved passages that address an AI are flagged and can't back facts or study items | eval B4, unit `injection` |
| M-4 | Medium | `verifyAnswer` | Citations were accepted when the id was retrieved, without checking the passage supports the claim | Claim-support check (quotes, numbers, coverage, negation) | unit `claim-support`, `runtime-gating` |
| M-5 | Medium | AI routes | No global spend cap or emergency stop (see the earlier residual risk) | `ops_flags` kill switch and daily token budget, `AI_KILL_SWITCH` env override, one run at a time; checked before quota is spent | `ai-guard.test.ts` |
| L-7 | Low | `GET /api/nudges/unsubscribe` | A state change on GET: mail scanners that prefetch links could unsubscribe students | GET shows a confirmation; POST (form or RFC 8058 one-click) unsubscribes | `nudges.test.ts` |
| L-8 | Low | `/api/mcp` | No per-token rate limit (`consume_rate_limit` relies on a session) | `consume_mcp_quota` (service-only function): 120 requests per 10 min | `memory-mcp.test.ts` |
| L-9 | Low | logging | Unstructured `console.error` lines with free text | Structured JSON logs with key and pattern redaction, request ids | unit `log` |

**Verified for the new surfaces:** RLS and column grants on `notification_prefs`, `feedback`, `copilot_memories`, `mcp_tokens` (two-student tests, owner spoofing gives 42501). `ops_flags` and `mcp_usage` aren't readable by students. MCP and calendar tokens are stored as SHA-256 hashes only and rotation invalidates the old token. Unsubscribe links are signed with an HMAC and compared in constant time. The nudge cron requires a 32+ character bearer secret. The quality page shows aggregates only.

**Data lifecycle:** deleting a document removes the stored file, its chunks and its retrievability (RAG eval: 0 passages, 0 chunks, 0 files). Account deletion cascades every student table. Remaining after a document is deleted: earlier copilot answers in run history keep their text and page references (no file content) until the run or account is deleted. Supabase backups follow the project's plan retention; deleted rows can persist in backups until they age out.

**Backup and restore drill (local only):** a full `pg_dump` restored into a scratch database. Row counts identical for 7 core tables and `auth.users`; 25 RLS tables restored with RLS on; 29 restore errors, all platform-privilege items (default privileges, vault, superuser functions), as expected when restoring as `postgres`.

**Residual (unchanged or new):** `style-src 'unsafe-inline'`; 120 s bearer source links; heuristic injection detection (see reviews/AI_SECURITY_RED_TEAM_REPORT.md); no error-alerting service yet (see reviews/OBSERVABILITY_REPORT.md).

## Day 6 delta review (2026-11-12): the agent team and voice answers

Scope: everything added since 4 Nov (Diagnostician and Quizmaster agents, mastery routes, Night Coach, Listen, voice answers; migrations 0025 and 0026).

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| D6-1 | Lecture text went to the Diagnostician and Quizmaster without the injection screening the copilot's search uses (a passage reading "ignore all previous instructions…" could reach the model, or be turned into a quiz question). Impact was limited (questions are validated against the page, answer keys are server-only, the specialists have no write tools), but the screening layer was missing on these two paths. | Medium | Fixed: instruction-like concepts are left out before any model sees them and before any fill-the-gap question is built; the data wrapper strips look-alike tags. Tests: `tests/unit/mastery.test.ts` (3), `tests/integration/mastery.test.ts` (fails without the fix). ADR-097. |
| D6-2 | `Permissions-Policy: microphone=()` turned the microphone off for the whole site while voice answers (11 Nov) rely on the browser's speech recognition, which can be blocked by that header. | Low (availability) | Fixed: `microphone=(self)`; camera, location and payment stay off and embedded frames cannot use the microphone. Asserted in `tests/e2e/hardening.spec.ts`. ADR-098. Not tried with a real microphone. |

Checked and unchanged: the new mastery routes validate input with strict Zod schemas, derive identity from the session and are rate-limited (`quiz` and `write` buckets); `assessment_keys` has no student grants (the integration test reads it as a student and gets 42501); `coach_briefs` lets a student read and delete only their own rows; the Night Coach and the specialists run with a 60 s timeout and at most 2 turns, and skip when the AI is paused or the daily budget is used.

Dependency and secret checks (12 Nov): `npm audit --omit=dev` found 0 vulnerabilities; a scan of tracked files for key patterns found none; the client bundle contains no key values (two harmless strings: the setup message that names `OPENAI_API_KEY`, and Supabase's own guard that rejects `sb_secret_` keys in a browser); the local Supabase ports listen on 127.0.0.1 only.

**Residual:** the injection screen is a heuristic (paraphrased instructions can pass; the other layers still hold); the specialists have not run against a live OpenAI model yet (the key is an owner step); no real-student pilot yet.
