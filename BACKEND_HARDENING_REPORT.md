# Backend hardening report · CatchUp AI

## Architecture (unchanged)
Next.js 16 route handlers + `src/proxy.ts` → Supabase (Auth, Postgres + RLS + pgvector, private Storage) → OpenAI Agents SDK for the copilot only. Scheduling, feasibility, quizzes, Teach-It-Back and the Rubric Decoder are deterministic. Writes the student can't be trusted with go through server-owned tables or SECURITY DEFINER functions that re-check `auth.uid()`.

## Changes in this pass
| Area | Change | Files |
| --- | --- | --- |
| Abuse/cost | Demo-account budgets; `compute` and `account` limits | `src/lib/http/rate-limit.ts`, 7 routes |
| Database | Rate-limit bucket allowlist with fixed windows; anon execute revoked | `supabase/migrations/20261104000009_rate_limit_allowlist.sql` |
| Headers | Nonce CSP, Origin check, HSTS | `src/proxy.ts`, `src/app/layout.tsx`, `next.config.ts` |
| Ops | Minimal health endpoint; constant-time cron auth | `src/app/api/health/route.ts`, `src/app/api/cron/cleanup-demo/route.ts` |
| CI | Typecheck, lint, unit, prod audit, build, bundle scan; integration + E2E + eval on local Supabase | `.github/workflows/ci.yml` |

## Reliability review (existing behaviour, verified by tests)
- **Transactions:** plan approval is one plpgsql transaction (lock, validate, insert plan + tasks, flip status). Checklist saves insert the new items before deleting old ones; quiz key insert failure removes the quiz.
- **Idempotency and concurrency:** approval idempotency key + row lock (10 parallel approvals → 1 plan); document processing claims a row so only one of two concurrent requests runs (409 for the other); no-overlap exclusion constraint on active tasks.
- **Scheduling edge cases:** time zones and DST, midnight wrap, zero availability, overdue required work (reported, not scheduled), honest shortfall, 200 randomised invariant runs, completed work subtracted on replans.
- **Failure handling:** model/tool failure → failed run, expired draft, no writes; rejected session token → refresh or sign-in; storage upload/processing failures mark the document failed with a safe code.
- **Long-running work:** processing (≤10 MB / 50 pages) and agent runs execute within the request (`maxDuration` 60 s / 120 s) with budgets; acceptable for the current limits. A queue would be needed for larger documents.

## Remaining issues and external dependencies
- Production configuration: Turnstile site key + Supabase CAPTCHA secret, OpenAI project spend limit, Resend SMTP, `CRON_SECRET` ≥ 32 chars, Supabase Auth URL settings (`docs/DEPLOYMENT.md`, `npm run preflight -- --production`).
- No error monitoring or alerting service is configured (platform logs only); add one before scaling.
- Backups and point-in-time recovery depend on the Supabase plan; restore procedure is documented in docs/DEPLOYMENT.md (rollback section).
- Live-model behaviour (latency, cost, jailbreak resistance) is untested until an OpenAI key is provided.
