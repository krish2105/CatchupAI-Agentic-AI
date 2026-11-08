# Atharva Soundankar: what is left, end to end (8–14 Nov 2026)

Owner: Krishna Mathur. The final submission is on **14 Nov 2026**. Same ground rules as [YASH_TASKS.md](YASH_TASKS.md): never push to `main`, one pull request per change, no secrets, no invented results. The owner's steps that unblock this list are in [KRISHNA_TASKS.md](KRISHNA_TASKS.md).

## Where the project stands (8 Nov, evening)
| Area | State |
| --- | --- |
| Live app | https://catchupai-chi.vercel.app at `eef23da`: ready, database ok, AI enabled; the last 19 uptime checks passed |
| Recorded real runs, no sign-in | https://catchupai-chi.vercel.app/watch |
| Tests on `main` | 244 unit · 174 integration · 82 end-to-end (8 Nov) |
| **CI on `main`** | **Red at `eef23da`**: "Start local Supabase" failed on the runner, not a test step. Needs a re-run (Krishna) |
| **Error alerts** | **Failing on every run since 6 Nov**: the `CRON_SECRET` repository secret isn't set (Krishna) |
| Open pull requests | #4 public-page fixes (Atharva): CI green, waiting for review · #5 UAE study defaults (Yash): CI green, changes requested on 8 Nov |
| Live model evaluation | 13 of 15 live runs passed; all 12 cases pass on their latest run. S2 passed both runs after its fix. 10 cases have run once, so there are no pass rates yet |
| Daily checkpoints | Days 0, 1 and 2 submitted on time |
| **Real users** | **None yet**: the usability pilot has not run ([reviews/USER_VALIDATION_REPORT.md](../../reviews/USER_VALIDATION_REPORT.md)) |
| **Demo video on the live model** | **Not recorded** |
| Screenshots in `docs/screenshots/` | From 3 Nov and show the scripted test model; need retaking on the live model |

The biggest gaps on the judging criteria are evidence from real students and presentation. Four things close them: the pilot (A1), the live-model video (A2), Krishna's settings on 9 Nov (K1–K3) and Yash's proactive check-in (Y2).

## Your tasks, in order

### A1. Run the usability pilot (8–11 Nov). Highest value. Status: not started
Judges score real-world applicability; today there is no evidence from real students.
- Recruit **3–5 students** (classmates are fine; Yash is bringing two). Use [docs/VOLUNTEER_KIT.md](../VOLUNTEER_KIT.md): consent first, synthetic course data only, no real personal documents.
- Each session ~20 minutes: try the demo, ask the copilot about the missed lecture, compare the plan routes, approve one, rate answers with 👍/👎.
- Record per person: task completed (yes/no), time taken, confusion points (quotes), the 1–5 usefulness rating. No names in anything public.
- Give the notes and signed consents to Krishna by **11 Nov 18:00 GST**. Krishna writes the results into `reviews/USER_VALIDATION_REPORT.md`. Never round up or fill gaps.

### A2. Help record the demo video (11–12 Nov). Status: not started
- With Krishna, record **2–3 minutes** on the live model with [demo/LIVE_DEMO_SHOT_LIST.md](../../demo/LIVE_DEMO_SHOT_LIST.md): problem → copilot answer with page citations and the tool timeline → honest plan with the shortfall → approval → one guardrail (the poisoned-notes case) → `/quality` and `/watch`.
- Record after 12:00 GST, when the free AI quota has reset. Krishna keeps that day's quota free. Keep a backup take; if the model is slow, show `/watch` and say it is a recorded real run.
- Ask the live copilot at least one question on camera and note its run id (`/runs/<id>`). It is also the first streamed answer through the deployed copilot on gemini-3.6-flash, which we haven't recorded yet.
- Add captions. Upload unlisted to YouTube and send Krishna the link.

### A3. Fresh screenshots (11 Nov, for Day 5). Status: not started
- Desktop 1440 px and phone 390 px, light and dark: dashboard, copilot answer with citations, recovery plan, approval, `/watch`.
- Only the live model (the "Scripted test model" chip must not appear). Open a pull request replacing the files in `docs/screenshots/` with the same names.
- Take them after PR #4 is deployed (new home hero), and after PR #5 if it is merged by then (Local calendar card, Hijri dates).

### A4. Quality pass on the live site. Status: done for the public pages, in PR #4
- `/`, `/watch`, `/quality` and `/pricing` were reviewed at 390 and 1440 px, light and dark; the fixes are in PR #4.
- Left: answer Krishna's review on #4. If #5 merges first, rebase #4 (both add rows to `BUILD_STATUS.md`).
- File anything else as a GitHub issue with a screenshot, the page and the steps. Label `bug` or `ux`. Especially anything confusing to a first-time visitor in the first 60 seconds (that is how long a judge spends).

### A5. Review Yash's pull requests (as they come). Status: PR #5 reviewed on 8 Nov
- Check out the branch, run `npm test` and click through the feature. Comment on anything unclear. Approve only what you tried.
- PR #5 got a comment, not an approval: one must-fix (the copilot sends the religious settings to Gemini and the privacy notice doesn't say so), one decision for Krishna (the iftar break) and four nits.
- Re-review after Yash's fixes. To click through, screen-share with Yash or install Docker Desktop for the local database; the Vercel preview can't save these settings before migration 0022 is in production.

### A6. Social engagement (every day; individual challenge)
- Like and comment on Krishna's DDS LinkedIn posts and in the DDS LinkedIn group; engagement is part of the challenge's leaderboard score.
- Don't submit CatchUp AI as your own entry unless DDS confirms in writing that team entries are allowed.

## Daily checkpoint calendar (Krishna submits; you help prepare)
| Day | Date (09:00 GST unlock) | What helps |
| --- | --- | --- |
| 3 | 9 Nov | Screenshot of the copilot answer with citations |
| 4 | 10 Nov | **Online demo**; pilot sessions under way |
| 5 | 11 Nov | Fresh screenshots (A3) |
| 6 | 12 Nov | Fresh test run numbers; security notes |
| 7 | 13 Nov | Demo video (A2); live link check |
| 8 | 14 Nov | Final submission and LinkedIn post (Krishna posts) |
