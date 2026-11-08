# Observability report

**Hosting:** Vercel (Hobby) + Supabase (Free), so built-in platform logs only, and no paid alerting. The monitoring below fits that: it costs nothing and needs no new accounts.

## What is monitored
| Signal | How | Where to look |
| --- | --- | --- |
| Liveness | `GET /api/health` → `{"status":"ok"}` | Uptime workflow, any monitor |
| Readiness | `GET /api/health/ready` → database round trip and AI state (`enabled`, `paused`, `not_configured`); **503** when the database is down. Doesn't reveal hosts or configuration values | Uptime workflow |
| Uptime alert | `.github/workflows/uptime.yml` runs `scripts/uptime-check.mjs` every 30 min: liveness, readiness, landing page with nonce CSP, `/quality`, protected-route redirect, cron protection. A failed run emails the repo owner | GitHub Actions → Uptime |
| Request ids | `x-request-id` on every response (Vercel's id when present), included in error logs and in 500 bodies as `correlationId` | Response headers, Vercel logs |
| API errors and latency | `route()` logs `api.request` for any 5xx or request slower than 3 s (path, method, status, ms, request id); `api.error` and `api.unhandled` for failures | Vercel → Logs, filter `"event":"api.` |
| Abuse and auth signals | `api.denied` for 401/403/429 (expired sessions, forbidden origin or ownership, rate limits); `mcp.rate_limited` | Vercel logs |
| Agent runs | `agent.run`: status, model, ms, input/output tokens, tool count, tool failures, removed facts, flagged passages, drafted or not. Failures include the error code (`timeout`, `max_turns`, `invalid_output`, `model_error`) | Vercel logs; `agent_runs` table |
| AI spend | Tokens per run in `agent_runs`; daily total enforced against `ops_flags.daily_token_budget` | `select sum(input_tokens+output_tokens) from agent_runs where created_at >= current_date` |
| RAG ingestion | `ingest.failed` (code), `ingest.embedding_failed` | Vercel logs; `documents.error_code` |
| Plan approval errors | Surface as `api.error` or `api.denied` with codes `stale`, `expired`, `infeasible` | Vercel logs |
| Deployment version and environment | `version` (commit) and `env` on every log line; `/quality` shows CI status for the deployed commit | Logs, `/quality` |
| Cron jobs | Non-2xx responses from `/api/cron/*` appear in Vercel's cron view and as `api.request` logs | Vercel → Cron Jobs |

## Privacy rules
Log fields never include document text, chat messages, emails, passwords, tokens or keys. `redact()` blanks any field whose
name looks sensitive (`token`, `secret`, `key`, `email`, `content`, `message`, `text`, `snippet`, …) and masks email addresses,
JWTs and key prefixes in free text (unit test `log`). Agents SDK tracing to external services is off.

## Demonstrated with safe simulated failures
- `node scripts/uptime-check.mjs https://catchupai-chi.vercel.app.invalid` → 6 failed checks, exit 1 (the alert path).
- Against production today: 5 of 6 checks pass. **Readiness returns 404 because this release branch isn't deployed yet**;
  it will pass after deployment.
- Kill switch, budget and concurrency gates: `tests/integration/ai-guard.test.ts` (6 tests).

## Not monitored (gaps)
- No error-tracking service (Sentry): it needs the owner's account and DSN. To add it: create a free Sentry project,
  set `SENTRY_DSN` on Vercel, then install `@sentry/nextjs` (about 30 min).
- No log retention beyond Vercel's plan window (about 1 hour of runtime logs on Hobby), and no log drains.
- No browser error reporting or real-user performance metrics.
- Alerts reach the repo owner only (GitHub email). There's no paging or on-call.

**Who responds:** the project owner. See INCIDENT_RESPONSE_RUNBOOK.md.
