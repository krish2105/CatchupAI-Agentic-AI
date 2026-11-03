# CatchUp AI: honest scorecard and the path to 95+

_Re-assessed 2026-11-04 after sprint 2 (catch-up pack, study emails, feedback, copilot memory, MCP, quality page, forest, demo video). Scores judge what is verifiable today, not what the code could do._

## Where it stands: **94 / 100** (history: 72 → 76 → 78 → 80 → 86 → 90 → 91 → 94: sprint 2 shipped and deployed with green CI; live AI still unmeasured)

| Lens | Score | What earns points | What costs points |
| --- | --- | --- | --- |
| **CEO** (problem, story, market) | 84 | Missed-lecture catch-up pack makes the core story concrete; captioned demo video; calendar sync, study emails | No users, pricing or outcome evidence yet |
| **CTO** (architecture, security) | 94 | RLS on 23 tables, idempotent approval RPC, nonce CSP, hash-only tokens (calendar, MCP), signed unsubscribe, CI on every push, public quality page with live CI and health | No error monitoring |
| **Senior PM** (scope, UX) | 93 | Every P0/P1 feature plus catch-up pack, memory panel, feedback in the flow; volunteer kit ready | Volunteer sessions not run yet |
| **COO** (operability) | 88 | Live with SMTP, CAPTCHA, CI, two crons (demo cleanup, nudges), usage limits, public health/quality page, feedback totals | No error alerting; nudge SMTP env not yet set |
| **AI engineer** | 80 | Gemini/OpenAI runtime switch, typed tools, structured output, budgets, per-run model/time/tokens surfaced | **No live model run yet** (key not entered) |
| **Agentic AI engineer** | 91 | 7 scoped tools incl. student-controlled memory (suggest → keep), read-only MCP server, persisted traces, propose → approve | Tool-selection eval cases need a real LLM |
| **RAG specialist** | 74 | Hybrid retrieval with RRF, page citations, abstention, eval-driven recall fix, citations in teach-back/rubric/trust drawer | Embeddings unused without a key; no claim-to-citation faithfulness metric |
| **Learning scientist** | 90 | Catch-up pack with retrieval practice, spaced revision, Teach-It-Back, reflection, recovery score | No measured learning outcomes with real students |
| **Competition judge** | 92 | Live URL, one-click demo, captioned demo video, public quality page, 248 tests + green CI | Live AI not shown yet |

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

94 + 6 = **100 possible**; **96 needs only the Gemini key (#2)**.

## Research notes
- Agentic-AI hackathon rubrics reward a **working, deployable demo**, technical depth, usefulness and presentation ([NANDA Hack](https://nandahack.media.mit.edu/), [GOSIM Paris](https://luma.com/6wdrnx9j), [FAU](https://www.fau.edu/engineering/pdf/agentic-ai-hackathon.pdf), [AngelHack](https://angelhack.com/blog/ai-agent-hackathon/)).
- Study planners commonly offer calendar sync, syllabus import and spaced repetition; **missed-lecture recovery is not a common feature** ([MyStudyLife](https://mystudylife.com/the-best-ai-study-tools-for-students-in-2026-apps-websites-and-resources-by-use-case/), [Dormway](https://dormway.app/blog/best-ai-study-planner-apps-2026)).
- RAG evaluation should separate retrieval from **citation faithfulness** ([DeepEval](https://deepeval.com/docs/metrics-citation-faithfulness), [OneUptime](https://oneuptime.com/blog/post/2026-08-31-rag-faithfulness-retrieval-vs-answer-quality/view)).
- Dark UI: elevation through lighter surfaces and borders, no pure black, desaturated accents ([UXcel](https://uxcel.com/blog/12-principles-of-dark-mode-design-627), [Onething](https://www.onething.design/post/best-practices-for-dark-mode-ui-design)).
