# Incident response runbook

**Responder:** the project owner (single maintainer). **Channels:** GitHub email from the Uptime workflow, Vercel dashboard, Supabase dashboard.

## First five minutes (any incident)
1. Open `https://catchupai-chi.vercel.app/api/health/ready`. Is the database `ok`? Is AI `enabled` or `paused`?
2. Vercel → Logs: filter `"level":"error"` and note the `requestId` and `event` of the first failures.
3. Decide: **pause AI**, **roll back**, or **wait** for an upstream provider (Supabase or Gemini status pages).
4. Write a one-line note with the time, symptom and action in `BUILD_STATUS.md` (execution log).

## Playbooks
| Situation | Action |
| --- | --- |
| AI costs or abuse spike | Supabase SQL editor: `update public.ops_flags set ai_enabled = false, note = 'paused: <reason>';` New copilot runs stop within 15 s; plans, notes, schedules and practice keep working. Fallback that works even if the database is unreachable: set `AI_KILL_SWITCH=1` on Vercel and redeploy. To resume: `ai_enabled = true`. |
| Daily budget too low or high | `update public.ops_flags set daily_token_budget = <tokens>;` |
| Model provider outage or timeouts | Nothing breaks permanently: failed runs are recorded and their drafts expired. Consider pausing AI so students see a clear message instead of failures. |
| Database down | Readiness returns 503 and pages show an error state. Check the Supabase status page and project health. There's no data-loss risk from the app side; wait or restore (below). |
| Bad deployment | Vercel → Deployments → previous good deployment → **Promote to production**. Then revert the commit on `main`. |
| Failed migration | Migrations are additive. Fix forward with a new migration; never edit an applied one. Don't run destructive SQL in production without a backup and an approval. |
| Leaked secret | Rotate it at the source (Supabase API keys, Gemini key, Gmail app password, `CRON_SECRET`), update Vercel env, redeploy. MCP or calendar tokens: the student revokes them in Preferences, or `delete from public.mcp_tokens where owner_id = …`. |
| Suspected data exposure | Pause AI, preserve logs (copy them out of Vercel), identify affected `owner_id`s via request ids, fix, then tell affected users. Get legal advice before any public statement. |
| Spam sign-ups or demo abuse | Turnstile is on. Lower the Supabase auth rate limits and the demo budgets (`DEMO_LIMITS`). The daily cron deletes demo accounts after 24 h. |
| Email failures | `/api/cron/nudges` returns 503 `mail_not_configured` or logs failures. Check the Gmail app password and Supabase SMTP settings. |

## Backups and restore
- Supabase backups depend on the plan. Check Database → Backups in the dashboard before relying on them. On the Free plan, take
  manual dumps: `supabase db dump --linked -f backup.sql` (schema) and `supabase db dump --linked --data-only -f data.sql`.
- A restore drill was done on the **local** stack only (full dump → scratch database, row counts identical). See SECURITY_AUDIT.md.
- Deleted student data can stay in backups until they expire.

## Billing (organisation plans, Stripe)
| Symptom | What to do |
| --- | --- |
| A school paid but still shows Free | /ops → Billing: is the event in "Recent Stripe events"? If not, check the webhook endpoint and its signing secret in Stripe (Developers → Webhooks → the endpoint's recent deliveries). A 400 there means `STRIPE_WEBHOOK_SECRET` doesn't match; fix it on Vercel and use "Resend" in Stripe. Events are applied once and in order, so resending is safe. |
| Webhook deliveries failing with 5xx | Error groups on /ops show the cause. Stripe retries for up to 3 days; fix forward and the retries apply. |
| Wrong charges or a refund request | Refunds and cancellations happen in the Stripe dashboard (test mode until live payments are approved); the plan follows through the webhook. Nothing in the app moves money. |
| Need to stop billing at once | Remove `STRIPE_SECRET_KEY` on Vercel and redeploy: checkout and the portal return "not available" (503), existing plans keep their current state. |

## Backup retention (to confirm per plan)
- Check Supabase → Database → Backups for the project's plan before promising any retention to a school. The figures aren't recorded here because they haven't been checked on this project.
- Until then: a manual dump before every production migration (commands above), kept outside the repository, and the local restore drill as the tested procedure.

## After the incident
Write what happened, when, the user impact, the root cause, the fix, and the regression test added. Link it from BUILD_STATUS.md.
