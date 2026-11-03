# CatchUp AI: honest scorecard and the path to 95+

_Re-assessed 2026-11-03 after Nature Flow 3.0, the smart replanner and focus session recovery. Scores judge what is verifiable today, not what the code could do._

## Where it stands: **78 / 100** (was 72, then 76)

| Lens | Score | What earns points | What costs points |
| --- | --- | --- | --- |
| **CEO** (problem, story, market) | 76 | Missed-lecture recovery is a gap competitors leave open; approval-first trust story; distinctive brand | No users, pricing or outcome evidence |
| **CTO** (architecture, security) | 87 | Composite-FK tenancy + RLS, idempotent approval RPC (10 concurrent → 1 plan), session-key recovery, server-only keys | No CSP header, no CI pipeline, no error monitoring |
| **Senior PM** (scope, UX) | 82 | Reference-matched screens, light/dark, phone bottom nav, missed-session replan, resumable focus | No calendar export; Teach-It-Back and Rubric Decoder not built |
| **COO** (operability) | 50 | Deployment guide, preflight, demo cleanup cron, per-student limits | **Not deployed**, no monitoring or support page |
| **AI engineer** | 74 | Typed tools, structured output, scripted-model tests, budgets | **No live model run yet** |
| **Agentic AI engineer** | 80 | Five scoped tools, persisted traces, propose → human approve; replans never apply without approval | Tool-selection eval cases still need a real LLM |
| **RAG specialist** | 72 | Hybrid lexical + vector with RRF, page citations, abstention, eval-driven recall fix | Embeddings unused without a key; no claim-to-citation check |
| **Learning scientist** | 84 | Spaced revision, adaptive retests, baseline vs latest, focus tracking, Teach-It-Back (self-explanation with cited feedback) | No reflection loop yet |
| **Competition judge** | 70 | Real working software with security tests and honest README | No live URL, no demo video, no user feedback |

## Feature audit (enhancement brief)

| # | Feature | Status | Notes |
| --- | --- | --- | --- |
| P0-1 | Smart Recovery Replanner | **Done (tested)** | Completed block minutes are subtracted; missed blocks surface on Mission Control and the bell; replan goes through the same approval |
| P0-2 | Teach-It-Back | **Done (tested)** | Deterministic concept check against retrieved passages, page citations, abstention without evidence, server-owned attempts, targeted retest |
| P0-3 | Assignment Rubric Decoder | Partial | Syllabus import already extracts dates; criteria/weights/word-count extraction with confirmation is the extension |
| P0-4 | Interactive What-If Planning | **Done** | Recovery Lab slider recomputes server-side with the deterministic engine; save-this-availability |
| P1-5 | Evidence and Trust Drawer | Partial | Citations, tool events and proposal status exist; needs one drawer with approval history |
| P1-6 | Learning Trail (prerequisites) | Partial | 3D/List universe from real courses; user-confirmed prerequisite links not built |
| P1-7 | Adaptive Revision Queue | **Done** | From graded quiz answers |
| P1-8 | Weekly reflection | Missing | Insights has the data; reflection prompt + next steps not built |
| P1-9 | Session auto-save | **Done (tested)** | Focus sessions resume after refresh or connection loss |
| P1-10 | Guided judge demo | Partial | One-click synthetic demo exists; a guided tour overlay is not built |

## Roadmap to 95+ (ordered by points per hour)

| # | Work | Gain | Who |
| --- | --- | --- | --- |
| 1 | **Go live**: Supabase cloud + Vercel, smoke test, URL in README | +7 | You log in; I do the rest |
| 2 | **Live agent**: OpenAI key → live copilot runs, embeddings, eval T1–T5, latency/cost per run | +5 | You add the key |
| 3 | ~~Teach-It-Back~~ (done) | +2 earned | — |
| 4 | **Rubric Decoder** (criteria → editable, source-linked checklist) | +2 | Me |
| 5 | **Ops**: CSP header, GitHub Actions CI, privacy page | +2 | Me |
| 6 | **Trust drawer** + calendar (.ics) export | +2 | Me |
| 7 | **Evidence**: 3–5 volunteer tests, 3–4 minute demo video, LinkedIn post | +3 | You (scripts ready) |

78 + 22 = **100 possible**; **95+ requires #1, #2 and #7**, which depend on your accounts and real people.

## Research notes
- Agentic-AI hackathon rubrics reward a **working, deployable demo**, technical depth, usefulness and presentation; some score fabricated tool calls ([NANDA Hack](https://nandahack.media.mit.edu/), [GOSIM Paris](https://luma.com/6wdrnx9j), [FAU](https://www.fau.edu/engineering/pdf/agentic-ai-hackathon.pdf), [AngelHack](https://angelhack.com/blog/ai-agent-hackathon/)).
- Study planners commonly offer calendar sync, syllabus import and spaced repetition; **missed-lecture recovery is not a common feature** ([MyStudyLife](https://mystudylife.com/the-best-ai-study-tools-for-students-in-2026-apps-websites-and-resources-by-use-case/), [Dormway](https://dormway.app/blog/best-ai-study-planner-apps-2026)).
- RAG evaluation should separate retrieval from **citation faithfulness** ([DeepEval](https://deepeval.com/docs/metrics-citation-faithfulness), [OneUptime](https://oneuptime.com/blog/post/2026-08-31-rag-faithfulness-retrieval-vs-answer-quality/view)).
- Dark UI: express elevation through lighter surfaces and borders rather than shadows, avoid pure black, desaturate accents ([UXcel](https://uxcel.com/blog/12-principles-of-dark-mode-design-627), [Onething](https://www.onething.design/post/best-practices-for-dark-mode-ui-design), [UX Planet](https://uxplanet.org/dark-mode-masterclass-d746227bac8f)).
