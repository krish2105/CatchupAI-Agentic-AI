# CatchUp AI: honest scorecard and the path to 95

_Assessed 2026-11-03 from the repository, test runs and the running app. Scores judge what is verifiable today, not what the code could do._

## Where it stands: **72 / 100**

| Lens | Score | What earns points | What costs points |
| --- | --- | --- | --- |
| **CEO** (problem, story, market) | 74 | Sharp, relatable problem (missed class → realistic recovery); approval-first trust story; distinctive Nature Flow brand | No users yet, no pricing or go-to-market, no outcome evidence |
| **CTO** (architecture, security) | 86 | Composite-FK tenancy + RLS on every table; SECURITY DEFINER approval RPC, idempotent under 10 concurrent requests; server-only keys; rate limits; session-key recovery | No CSP header, no CI pipeline, no error monitoring |
| **Senior PM** (scope, UX, delivery) | 76 | Nine screens, honest empty states, keyboard + axe-clean, mobile drawer, 171 automated tests | Some screens busier than the references; no calendar export; no notifications |
| **COO** (operability) | 50 | Deployment guide, preflight, demo cleanup cron, cost ceiling per student | **Not deployed**, no monitoring/alerting, no support or privacy page |
| **AI engineer** | 74 | Typed tool contracts, structured output, scripted-model tests, budget limits | **No live model run yet**, so no latency, cost or quality numbers |
| **Agentic AI engineer** | 78 | One agent with five scoped tools, traces persisted, agent proposes and human approves | No re-planning when a block is missed; tool-selection eval cases skipped (need a real LLM) |
| **RAG specialist** | 72 | Hybrid lexical + vector with RRF, page-faithful chunks, abstention, 30-case eval found and fixed a recall bug | Embeddings unused without a key; no reranker; no faithfulness (claim-to-citation) metric |
| **Competition judge** | 68 | Real working software, not slideware; security tests; honest README | No live URL, no demo video, no user feedback |

## Roadmap to 95 (ordered by points per hour)

| # | Work | Gain | Who |
| --- | --- | --- | --- |
| 1 | **Go live**: Supabase cloud + Vercel, smoke test, URL in README | +7 | You log in; I do the rest |
| 2 | **Live agent**: OpenAI key → live copilot run, embeddings, eval T1–T5, real latency/cost per run | +5 | You add the key; I run and record |
| 3 | **Nature Flow 3.0** visual pass (photographic heroes, serif display type, the six reference screens, mobile bottom nav, moonlit dark) | +3 | Me (in progress) |
| 4 | **Calendar export** (.ics feed for approved plans → Google/Apple/Outlook) | +2 | Me |
| 5 | **Missed-block re-plan**: mark a block missed → deterministic reschedule proposal → approval | +2 | Me |
| 6 | **Notifications bell** from real data (due revisions, pending proposals, deadlines in 48 h) | +1 | Me |
| 7 | **Ops**: CSP header, GitHub Actions CI (typecheck, lint, unit, E2E against local Supabase), privacy page | +2 | Me |
| 8 | **RAG quality**: claim-to-citation faithfulness check in the eval with the live model; optional reranker | +1 | Me, after #2 |
| 9 | **Evidence**: 3–5 volunteer tests (real notes), 3–4 minute demo video, LinkedIn post | +3 | You (I prepare scripts) |

Reaching 95 requires #1, #2 and #9. They depend on your accounts and on real people, and can't be simulated.

## Research notes
- Agentic-AI hackathon rubrics consistently reward a **working, deployable demo over slides**, technical depth, real-world usefulness and presentation; some score production signals such as fabricated tool calls ([NANDA Hack](https://nandahack.media.mit.edu/), [GOSIM Paris](https://luma.com/6wdrnx9j), [FAU](https://www.fau.edu/engineering/pdf/agentic-ai-hackathon.pdf), [AngelHack](https://angelhack.com/blog/ai-agent-hackathon/)).
- Study-planner products commonly offer calendar sync, syllabus/LMS import and spaced repetition; **missed-lecture recovery is not a common feature**, which is CatchUp's differentiator ([MyStudyLife](https://mystudylife.com/the-best-ai-study-tools-for-students-in-2026-apps-websites-and-resources-by-use-case/), [Dormway](https://dormway.app/blog/best-ai-study-planner-apps-2026)).
- RAG evaluation guidance separates retrieval quality from **citation faithfulness** (whether the cited passage supports the claim) and recommends running the same set as a CI gate ([DeepEval](https://deepeval.com/docs/metrics-citation-faithfulness), [OneUptime](https://oneuptime.com/blog/post/2026-08-31-rag-faithfulness-retrieval-vs-answer-quality/view), [alphaXiv summary](https://alphaxiv.org/overview/2412.18004v1)).
