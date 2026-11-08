# Atharva Soundankar: what is left, end to end (8–14 Nov 2026)

Owner: Krishna Mathur. The final submission is on **14 Nov 2026**. Same ground rules as [YASH_TASKS.md](YASH_TASKS.md): never push to `main`, one pull request per change, no secrets, no invented results.

## Where the project stands (8 Nov)
| Area | State |
| --- | --- |
| Live app | https://catchupai-chi.vercel.app, CI on every push |
| Recorded real runs, no sign-in | https://catchupai-chi.vercel.app/watch |
| Tests | 244 unit · 174 integration · 82 end-to-end, all passing (8 Nov) |
| Live model evaluation | 12 of 12 cases pass on their latest run; only 1–3 runs per case, so not yet a pass rate |
| Daily checkpoints | Days 0, 1 and 2 submitted on time |
| **Real users** | **None yet**: the usability pilot has not run ([reviews/USER_VALIDATION_REPORT.md](../../reviews/USER_VALIDATION_REPORT.md)) |
| **Demo video on the live model** | **Not recorded** |
| Screenshots in `docs/screenshots/` | From 3 Nov and show the scripted test model; need retaking on the live model |

## Your tasks, in order

### A1. Run the usability pilot (8–11 Nov). Highest value.
Judges score real-world applicability; today there is no evidence from real students.
- Recruit **3–5 students** (classmates are fine). Use [docs/VOLUNTEER_KIT.md](../VOLUNTEER_KIT.md): consent first, synthetic course data only, no real personal documents.
- Each session ~20 minutes: try the demo, ask the copilot about the missed lecture, compare the plan routes, approve one, rate answers with 👍/👎.
- Record per person: task completed (yes/no), time taken, confusion points (quotes), the 1–5 usefulness rating. No names in anything public.
- Give the notes and signed consents to Krishna by **11 Nov 18:00 GST**. Krishna writes the results into `reviews/USER_VALIDATION_REPORT.md`. Never round up or fill gaps.

### A2. Help record the demo video (11–12 Nov)
- With Krishna, record **2–3 minutes** on the live model with [demo/LIVE_DEMO_SHOT_LIST.md](../../demo/LIVE_DEMO_SHOT_LIST.md): problem → copilot answer with page citations and the tool timeline → honest plan with the shortfall → approval → one guardrail (the poisoned-notes case) → `/quality` and `/watch`.
- Record after 12:00 GST, when the free AI quota has reset. Keep a backup take; if the model is slow, show `/watch` and say it is a recorded real run.
- Add captions. Upload unlisted to YouTube and send Krishna the link.

### A3. Fresh screenshots (11 Nov, for Day 5)
- Desktop 1440 px and phone 390 px, light and dark: dashboard, copilot answer with citations, recovery plan, approval, `/watch`.
- Only the live model (the "Scripted test model" chip must not appear). Open a pull request replacing the files in `docs/screenshots/` with the same names.

### A4. Quality pass on the live site (any day)
- Click through the home page, the demo, `/watch`, `/quality`, `/pricing` on a phone and a laptop.
- File each problem as a GitHub issue with a screenshot, the page and the steps. Label `bug` or `ux`.
- Especially: anything confusing to a first-time visitor in the first 60 seconds (that is how long a judge spends).

### A5. Review Yash's pull requests (as they come)
- Check out the branch, run `npm test` and click through the feature. Comment on anything unclear. Approve only what you tried.

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
