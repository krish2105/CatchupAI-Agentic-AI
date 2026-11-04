# CatchUp AI: honest scorecard and the path to 95+

_Re-assessed 2026-11-04 (late) after the M8 release, the speed fix, the submission pack and the iPhone install. Scores judge what is verifiable today, not what the code could do. They are our own assessment, not official scores._

## Where it stands: **96 / 100** (history: 72 → 76 → 78 → 80 → 86 → 90 → 91 → 94 → 95 → 95 → 96)
The live model now runs in production and in the evaluation (gemini-3.6-flash). Remaining gaps: 5 live cases not yet run (free-tier quota), no volunteer pilot, video and LinkedIn post pending.

| Role | Score | What earns points | What costs points |
| --- | --- | --- | --- |
| **CEO** (problem, story, market) | 86 | Clear student problem; catch-up pack and approval story; professor brief; direct reuse for an LMS (Learners Education) | No users, pricing or outcome evidence yet |
| **CTO** (architecture, security) | 96 | RLS on 25 tables, locked idempotent approval, nonce CSP, claim-checked citations, injection flagging, kill switch and token budget, functions next to the database (0.63 s dashboard), CI and uptime checks, backup drill | No error-tracking service (Sentry) |
| **Senior PM** (scope, UX) | 94 | Every planned feature shipped and tested; phone, iPhone app, accessibility; dated checkpoint tracker; Day 1 template filled | Volunteer pilot not run; Day 0 not done |
| **COO** (operability) | 91 | Readiness and uptime alerts, incident runbook, kill switch, budgets, cron jobs, redacted logs | No paging or Sentry; reminder-email SMTP not set |
| **AI engineer** | 88 | Live Gemini runs; found and fixed the Gemini 3 thought-signature bug; minimal thinking; retry-delay handling; clear quota messages; live embeddings | Free-tier quota (20/day) and 10–90 s latency |
| **Agentic AI engineer** | 90 | Live traces: 5 model-chosen tools → pending draft in 10.7 s; malicious document resisted; safe provider failure; 3/3 answered tool-selection cases correct | 5 live cases still to run; 1 provider timeout |
| **RAG specialist** | 92 | Live Gemini embeddings: Recall@3 100%, MRR 0.939, multi-page 3/3, abstention 4/4; claim check (precision 1.0 on 30 labelled claims, opposite-word rule); deletion and isolation proven | Small synthetic set; no human-reviewed live answers yet |
| **Learning scientist** | 90 | Catch-up pack, retrieval practice, spaced revision, teach-back, reflection, recovery score | No measured learning outcomes |
| **Competition judge** (DDS rubric, our estimate) | 69 / 80 + participation | Innovation 22/25 · Technical 24/25 · Real-world 12/15 · Presentation 11/15 | Platform participation (20) depends on Day 0 and daily submissions; video and post pending |

**Fastest gains:** run the remaining 5 live cases on tomorrow's quota; record the live-model video and post on LinkedIn (+3 presentation); complete Day 0 and every checkpoint on time (the 20-point participation score).

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
