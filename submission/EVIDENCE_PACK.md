# CatchUp AI: competition evidence pack

One page for judges. Every line links to something you can open or rerun.

| What | Where | State (2026-11-08) |
| --- | --- | --- |
| Live app | https://catchupai-chi.vercel.app (**Try the demo, no sign-up**: synthetic data, deleted after 24 h) | Live |
| Source code | https://github.com/krish2105/CatchupAI-Agentic-AI | Public |
| Live quality page | https://catchupai-chi.vercel.app/quality (CI status for the deployed commit, database health, test and eval counts) | Live |
| Watch a real run | https://catchupai-chi.vercel.app/watch: the latest live run of each scenario played back step by step from the committed traces (no sign-in, no model call) | Live after the 8 Nov release |
| Demo video | Recording guide: [demo/DEMO_VIDEO_SCRIPT.pdf](../demo/DEMO_VIDEO_SCRIPT.pdf). Scripted-model cut: `demo/out/catchup-ai-demo.mp4` (2:13, labelled; not in git) | **Live-model video not recorded** |
| Architecture | [architecture/catchup-ai-architecture.png](architecture/catchup-ai-architecture.png) (+ SVG source, PDF) · [AGENTIC_WALKTHROUGH.md](AGENTIC_WALKTHROUGH.md) | Ready |
| Reports | [reports/FINAL_PROJECT_REPORT.pdf](reports/FINAL_PROJECT_REPORT.pdf) · [reports/AGENTIC_AI_TECHNICAL_BRIEF.pdf](reports/AGENTIC_AI_TECHNICAL_BRIEF.pdf) (DOCX alongside) | Ready |
| Daily checkpoints | Day 0, Day 1 and Day 2 submitted on the DDS portal on time (the filled templates stay private: DDS template copyright) | On time |
| What is agentic | [AGENTIC_AI_AUDIT.md](../reviews/AGENTIC_AI_AUDIT.md): 1 agent, 7 tools, model-chosen order, approval-gated | Ready |
| Agent traces | [docs/evidence/agent-traces](../docs/evidence/agent-traces): live S1 (recovery), S3 (malicious document), S4 (provider failure) pass; S2 (overloaded week) failed on 5 Nov, then passed its live re-runs on 7 and 8 Nov after the fix (ADR-078) | ✅ Live, all 4 pass on their latest run |
| Tests | 244 unit · 174 integration · 82 end-to-end (production build), all passing locally on 8 Nov; CI on every push | Verified |
| Agent evaluation | [evals/REPORT.md](../evals/REPORT.md): 38 cases, **38 pass** on each case's latest real result; live: 12 of 12 cases pass on their latest run (13 of 15 live runs passed in all, 4–8 Nov); every attempt, including quota failures, in [LIVE_AGENT_EVALUATION_REPORT.md](../reviews/LIVE_AGENT_EVALUATION_REPORT.md) | Verified (1–3 runs per case, not yet a pass rate) |
| RAG evaluation | [evals/RAG_REPORT.md](../evals/RAG_REPORT.md): 51 questions over 3 synthetic courses, live embeddings, Recall@3 100%, Recall@1 94.1%, MRR 0.971, abstention 7/7 with no false abstentions; claim checker precision 1.0 / recall 1.0 on 30 labelled claims; cross-user isolation in [RAG_QUALITY_REPORT.md](../reviews/RAG_QUALITY_REPORT.md) | Verified |
| Security | [SECURITY_AUDIT.md](../SECURITY_AUDIT.md), [AI_SECURITY_RED_TEAM_REPORT.md](../reviews/AI_SECURITY_RED_TEAM_REPORT.md): no open Critical or High findings | Verified |
| Operations | [OBSERVABILITY_REPORT.md](../reviews/OBSERVABILITY_REPORT.md), [INCIDENT_RESPONSE_RUNBOOK.md](../reviews/INCIDENT_RESPONSE_RUNBOOK.md) | Ready |
| Usability pilot | [USER_VALIDATION_REPORT.md](../reviews/USER_VALIDATION_REPORT.md) + [docs/VOLUNTEER_KIT.md](../docs/VOLUNTEER_KIT.md) | **Not conducted** |
| Screenshots | `docs/screenshots/` (app) · `docs/evidence/production/` (live public pages, desktop and phone, light and dark) | Ready |
| iPhone app | `ios/` (built with Xcode, runs in the simulator) | Ready (not on the App Store) |

Nothing in the public repo contains keys, real student data or personal documents (`outbox/` is git-ignored).
