# Krishna Mathur: owner steps (8–14 Nov 2026)

Only the owner can do these: repository and Vercel settings, merges, production migrations and the submissions. They unblock [ATHARVA_TASKS.md](ATHARVA_TASKS.md) and [YASH_TASKS.md](YASH_TASKS.md). In date order.

| # | Step | By | Why |
| --- | --- | --- | --- |
| K1 | Add the `CRON_SECRET` repository secret, with the same value as on Vercel | 9 Nov | "Error alerts" has failed on every run since 6 Nov with "Add the CRON_SECRET repository secret first", so a new production error alerts nobody |
| K2 | On Vercel, set `OPS_OWNER_EMAILS` and `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite`, then redeploy | 9 Nov | Owner access to `/ops`, and a fallback with its own quota when gemini-3.6-flash runs out (ADR-077). Neither is confirmed set |
| K3 | Re-run CI on `main` | 9 Nov | `eef23da` failed in "Start local Supabase" on the runner, not in a test; the red mark shows on GitHub until it passes |
| K4 | Review and merge PR #4, then deploy | 9 Nov | Public-page fixes for a first-time visitor, and a CI tile on `/quality` that reads only the CI workflow |
| K5 | Merge PR #5 once Yash's privacy fix is in, then apply migration 0022 (`npx supabase db push --remote`). Decide review item 2 (study resumes right at Maghrib, i.e. iftar) | 10 Nov | Until 0022 is applied, saving the Local calendar card answers "not available yet" |
| K6 | Live evaluation repeats: `LIVE_CASES=S1,S3,T4 LIVE_PAUSE_MS=65000 npm run eval -- evals/agent.eval.ts evals/agentic-scenarios.eval.ts`, after 12:00 GST, until each has 3 runs | 9–12 Nov | Pass rates instead of single runs. Keep 11–12 Nov quota free for the video |
| K7 | Upload one scanned PDF on the live site | 10 Nov | OCR has been checked live on one page only |
| K8 | Write the pilot results into `reviews/USER_VALIDATION_REPORT.md` exactly as recorded | 11 Nov | The only evidence from real students. Never round up or fill gaps |
| K9 | Daily checkpoints, Days 3–8, on time; Day 4 (10 Nov) is the online demo | Daily | Participation counts in full only if every checkpoint lands |
| K10 | Pitch deck from real numbers, final submission, LinkedIn post | 13–14 Nov | Presentation |
| K11 | Optional: Stripe test keys and one test-card checkout | Any day | Billing evidence; not a judging criterion |
