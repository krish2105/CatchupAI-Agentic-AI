# CatchUp AI: honest scorecard and the path to 95+

_Re-assessed 2026-11-04 after the feature batch (calendar export, guided tour, trust drawer, weekly review, learning trail, PWA) and the security pass. Scores judge what is verifiable today, not what the code could do._

## Where it stands: **91 / 100** (history: 72 → 76 → 78 → 80 → 86 → 90 → 91: live, with email and bot protection)

| Lens | Score | What earns points | What costs points |
| --- | --- | --- | --- |
| **CEO** (problem, story, market) | 79 | Missed-lecture recovery is a gap competitors leave open; guided demo tells the story in 3 minutes; calendar sync makes plans real | No users, pricing or outcome evidence |
| **CTO** (architecture, security) | 92 | RLS + composite keys everywhere, idempotent approval RPC, nonce CSP, Origin checks, rate-limit allowlist, CI on every push (unit → integration → E2E → eval) | No error monitoring; not yet proven on hosted infrastructure |
| **Senior PM** (scope, UX) | 90 | Ten reference-matched screens, light/forest-night themes, mobile bottom nav, every P0 and P1 feature shipped and tested | Volunteer usability evidence missing |
| **COO** (operability) | 84 | Live on Vercel + Supabase (Seoul) with custom SMTP, 6-digit code emails, Turnstile CAPTCHA, CI, demo cleanup cron, usage/limit visibility, health check | No error alerting; Gmail SMTP caps ~500 mails/day |
| **AI engineer** | 75 | Typed tools, structured output, budgets, scripted-model tests | **No live model run yet** (latency, cost, quality unmeasured) |
| **Agentic AI engineer** | 85 | Scoped tools, persisted traces, propose → human approve, replanner, trust drawer showing exactly which tools ran | Tool-selection eval cases need a real LLM |
| **RAG specialist** | 74 | Hybrid retrieval with RRF, page citations, abstention, eval-driven recall fix, citations in teach-back/rubric/trust drawer | Embeddings unused without a key; no claim-to-citation faithfulness metric |
| **Learning scientist** | 88 | Spaced revision, adaptive retests, Teach-It-Back (self-explanation), weekly reflection, prerequisite-aware study order | No measured learning outcomes with real students |
| **Competition judge** | 84 | Live URL with a one-click guided demo, security reports, 224 tests + green CI | No demo video yet |

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
| 2 | **Live agent**: OpenAI key → live runs, embeddings, eval T1–T5, latency/cost recorded | +4 | You add the key |
| 3 | **Evidence**: 3–5 volunteer tests, 3–4 minute demo video, LinkedIn post | +3 | You (scripts ready) |
| 4 | Error monitoring (e.g. Sentry free tier) | +1 | You create the account; I wire it |

91 + 8 = **99 possible**; **95 needs the OpenAI key (#2) and the demo video + volunteer tests (#3)**.

## Research notes
- Agentic-AI hackathon rubrics reward a **working, deployable demo**, technical depth, usefulness and presentation ([NANDA Hack](https://nandahack.media.mit.edu/), [GOSIM Paris](https://luma.com/6wdrnx9j), [FAU](https://www.fau.edu/engineering/pdf/agentic-ai-hackathon.pdf), [AngelHack](https://angelhack.com/blog/ai-agent-hackathon/)).
- Study planners commonly offer calendar sync, syllabus import and spaced repetition; **missed-lecture recovery is not a common feature** ([MyStudyLife](https://mystudylife.com/the-best-ai-study-tools-for-students-in-2026-apps-websites-and-resources-by-use-case/), [Dormway](https://dormway.app/blog/best-ai-study-planner-apps-2026)).
- RAG evaluation should separate retrieval from **citation faithfulness** ([DeepEval](https://deepeval.com/docs/metrics-citation-faithfulness), [OneUptime](https://oneuptime.com/blog/post/2026-08-31-rag-faithfulness-retrieval-vs-answer-quality/view)).
- Dark UI: elevation through lighter surfaces and borders, no pure black, desaturated accents ([UXcel](https://uxcel.com/blog/12-principles-of-dark-mode-design-627), [Onething](https://www.onething.design/post/best-practices-for-dark-mode-ui-design)).
