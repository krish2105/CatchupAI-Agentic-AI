# CatchUp AI: honest scorecard and the path to 95+

_Re-assessed 2026-11-05 after the remaining live cases, the live fallback, streaming and OCR checks, and the streaming fix (ADR-076). Scores judge what is verifiable today, not what the code could do. They are our own assessment, not official scores._

## Where it stands: **97 / 100** (history: 72 → 76 → 78 → 80 → 86 → 90 → 91 → 94 → 95 → 95 → 96 → 97)
Live in production: model fallback, streamed answers, tool-result cache, plan self-check, agent trace viewer, self-hosted error tracking, /ops, public /status, month calendar and recovery tracker, opposite-word claim check, FSRS revision, pre/post checks, LMS import, privacy and terms. Organisations, email invites and the admin console are in production (all 20 migrations applied); billing is wired but off until Stripe test keys are set. Every one is covered by unit, integration and E2E tests with the scripted model. All 12 live cases have now run on Gemini (latest per case 11/12 pass, S2 fails). The fallback triggered live, and streaming completed live after a real bug was found and fixed. What holds the score back: one run per case (no pass rates yet), S2's loop on the fallback model, the streaming fix not yet deployed, and no pilot, video or LinkedIn post.

| Role | Before | Now | What earns points | What costs points |
| --- | --- | --- | --- | --- |
| **CEO** (problem, story, market) | 86 | **88** | Clear problem, catch-up pack, approval story; status page; plain-language privacy and terms; LMS export import lowers switching cost | No users, pricing or outcome evidence |
| **CTO** (architecture, security) | 96 | **98** | Error tracking without a third party (redacted at source, grouped, server-only table), owner-only /ops (everyone else gets not-found), readiness shared by /status and uptime, self-check enforced before approval, 21 migrations with RLS, all applied in production (0021, scanned-PDF OCR, on 5 Nov) | Alerts not active until the `CRON_SECRET` repo secret is set |
| **Senior PM** (scope, UX) | 94 | **96** | Calendar and tracker from a research report, with follow-ups shipped (done view, draft blocks, colour key); getting-started checklist and activation funnel; trace viewer; status page | No pilot; Day 0 not done |
| **COO** (operability) | 91 | **94** | Kill switch and budget editable in /ops, error groups with resolve, public incident notes, uptime history | `OPS_OWNER_EMAILS` and `CRON_SECRET` not set yet; reminder SMTP not set |
| **AI engineer** | 91 | **93** | Fallback triggered on a live daily-quota 429; streamed answers completed on live Gemini after a signature bug was found by the live run and fixed (ADR-076); fallback model chosen by live probes (ADR-077) | Streaming not yet run on gemini-3.6-flash or the deployed route; free-tier latency |
| **Agentic AI engineer** | 93 | **94** | All 12 live cases run: T1–T8 8/8, S1, S3, S4 pass; guards held live (unsupported fact removed in T4, drafts citing unretrieved sources refused in S2, failed run's draft expired) | S2 failed live (looped to the turn limit); fix shipped but not yet re-run live; one run per case |
| **RAG specialist** | 95 | **95** | Gold set 18 → 51 over 3 courses; hybrid run on all 51 with live embeddings: Recall@3 100%, Recall@1 94.1%, MRR 0.971, abstention 7/7, no false abstentions (keyword-only: 88.2%); claim-check precision 1.0 on 30 labelled claims; opt-in faithfulness judge that can only remove facts; scanned PDFs read by OCR with a "from scan" label | Judge agreement with labels not measured live yet; OCR checked live on one page only (68/68 words exact); synthetic material only |
| **Learning scientist** | 90 | **94** | FSRS spaced revision; graded pre- and post-check per catch-up pack with the gain on Insights; tracker without streaks or points, fresh week each Monday | No real students' learning gains measured yet |
| **MVP** | 78 | **87** | Streamed answers, self-checked plans, month calendar, tracker, LMS import, getting-started checklist, clearer scanned-PDF path, privacy and terms | No real users; one live run per case |
| **SaaS** | 45 | **89** | Organisations, invites and admin actions live (0018–0020 in production); Stripe test billing wired end to end (checkout, portal, signed webhook, admin plan card, /pricing); email invites, admin console (remove, rename, delete, audit log + CSV); 2× copilot limit on the Class plan; billing on /ops and /status, billing playbooks, DPA template; legal pages; LMS import | Signed-in invite flow not yet tried on the live site; no real test-card checkout run yet (needs your Stripe test keys); no paying institution |
| **Competition judge** (DDS rubric, our estimate) | 69 / 80 | **73 / 80** + participation | Innovation 23/25 · Technical 25/25 · Real-world 14/15 · Presentation 11/15 | Participation (20) depends on Day 0 and daily submissions; video and post pending |

**Fastest gains now:** deploy the streaming fix; set `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite`, `CRON_SECRET` and `OPS_OWNER_EMAILS` (COO +2); fix S2 and repeat each live case ×3 on fresh quota (agentic +1–2); Day 0 and every checkpoint on time (participation 20); live-model video and LinkedIn post (presentation +3); 3–5 pilot sessions (CEO, PM, MVP, learning scientist).

## What's left

| # | Work | Gain | Who |
| --- | --- | --- | --- |
| 1 | Re-run S2 live (recovery fix ADR-078 is in, tested with the scripted model), then each live case ×3 with `LIVE_PAUSE_MS=65000`; a streamed run on gemini-3.6-flash (all 12 cases ran once on 4–5 Nov) | +1–2 (agentic) | Code (quota-gated) |
| 2 | Set `OPS_OWNER_EMAILS`, `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite` (Vercel) and `CRON_SECRET` (GitHub secret) | +2 COO | You |
| 3 | Add Stripe test keys and run one test-card checkout with `stripe listen` (migrations through 0021 applied 5 Nov); upload one scanned PDF on the live site to see OCR end to end | SaaS 89 → 91 | You |
| 4 | Faithfulness judge agreement with labels (`JUDGE_LIVE=1`) (live OCR check done 5 Nov: 68/68 words) | +1 RAG | Code (chat quota) |
| 5 | Pitch deck from real numbers; record the live-model demo (shot list and narration exist) | +2–3 presentation | Code drafts, you record |
| 6 | Day 0, daily checkpoints, pilot, video, LinkedIn, final submission | participation 20 + evidence | You |

## Feature audit (enhancement brief)

| # | Feature | Status |
| --- | --- | --- |
| P0-1 | Smart Recovery Replanner | **Done (tested)** |
| P0-2 | Teach-It-Back | **Done (tested)** |
| P0-3 | Assignment Rubric Decoder | **Done (tested)** |
| P0-4 | Interactive What-If Planning | **Done** |
| P1-5 | Evidence and Trust Drawer | **Done (tested)** |
| P1-6 | Learning Trail with prerequisites | **Done (tested)**: student-confirmed course links, 3D arcs, study order |
| P1-7 | Adaptive Revision Queue | **Done** |
| P1-8 | Weekly reflection and next steps | **Done (tested)** |
| P1-9 | Session auto-save | **Done (tested)** |
| P1-10 | Guided judge demo | **Done (tested)** |

## What's left to reach 95+ (all need you)

| # | Work | Gain | Who |
| --- | --- | --- | --- |
| 1 | ~~Go live, SMTP, Turnstile~~ (done: https://catchupai-chi.vercel.app) | +5 earned | — |
| 2 | **Live agent**: enter the Gemini key (`python3 scripts/configure-ai.py`, waiting in your terminal) → live runs, eval T1–T5, latency/tokens recorded | +3 | You type the key |
| 3 | **Evidence**: 3–5 volunteer sessions with `docs/VOLUNTEER_KIT.md`; LinkedIn post with the demo video | +2 | You run the sessions |
| 4 | Error monitoring (Sentry free tier) and nudge SMTP (`python3 scripts/configure-nudge-email.py`) | +1 | You create the account / type the app password |

95 + 5 = **100 possible**; **97 needs only the Gemini key (#2)**, because the live eval would then close the last mandatory M8 gate.

## Research notes
- Agentic-AI hackathon rubrics reward a **working, deployable demo**, technical depth, usefulness and presentation ([NANDA Hack](https://nandahack.media.mit.edu/), [GOSIM Paris](https://luma.com/6wdrnx9j), [FAU](https://www.fau.edu/engineering/pdf/agentic-ai-hackathon.pdf), [AngelHack](https://angelhack.com/blog/ai-agent-hackathon/)).
- Study planners commonly offer calendar sync, syllabus import and spaced repetition; **missed-lecture recovery is not a common feature** ([MyStudyLife](https://mystudylife.com/the-best-ai-study-tools-for-students-in-2026-apps-websites-and-resources-by-use-case/), [Dormway](https://dormway.app/blog/best-ai-study-planner-apps-2026)).
- RAG evaluation should separate retrieval from **citation faithfulness** ([DeepEval](https://deepeval.com/docs/metrics-citation-faithfulness), [OneUptime](https://oneuptime.com/blog/post/2026-08-31-rag-faithfulness-retrieval-vs-answer-quality/view)).
- Dark UI: elevation through lighter surfaces and borders, no pure black, desaturated accents ([UXcel](https://uxcel.com/blog/12-principles-of-dark-mode-design-627), [Onething](https://www.onething.design/post/best-practices-for-dark-mode-ui-design)).
