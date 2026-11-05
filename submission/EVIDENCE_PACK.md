# CatchUp AI: competition evidence pack

One page for judges. Every line links to something you can open or rerun.

| What | Where | State (2026-11-04) |
| --- | --- | --- |
| Live app | https://catchupai-chi.vercel.app (**Try the demo, no sign-up**: synthetic data, deleted after 24 h) | Live |
| Source code | https://github.com/krish2105/CatchupAI-Agentic-AI | Public |
| Live quality page | https://catchupai-chi.vercel.app/quality (CI status for the deployed commit, database health, test and eval counts) | Live |
| Demo video | Recording guide: [demo/DEMO_VIDEO_SCRIPT.pdf](demo/DEMO_VIDEO_SCRIPT.pdf). Scripted-model cut: `demo/out/catchup-ai-demo.mp4` (2:13, labelled; not in git) | **Live-model video not recorded** |
| Architecture | [architecture/catchup-ai-architecture.png](architecture/catchup-ai-architecture.png) (+ SVG source, PDF) · [AGENTIC_WALKTHROUGH.md](AGENTIC_WALKTHROUGH.md) | Ready |
| Reports | [reports/FINAL_PROJECT_REPORT.pdf](reports/FINAL_PROJECT_REPORT.pdf) · [reports/AGENTIC_AI_TECHNICAL_BRIEF.pdf](reports/AGENTIC_AI_TECHNICAL_BRIEF.pdf) (DOCX alongside) | Ready |
| Day 1 template | [completed_templates/Day_1_Idea_Submission_CatchUp_AI_Krishna_Mathur.pdf](completed_templates/Day_1_Idea_Submission_CatchUp_AI_Krishna_Mathur.pdf) (official template filled; DOCX alongside; **local only**, DDS copyright) | Ready; instructor review pending |
| What is agentic | [AGENTIC_AI_AUDIT.md](../AGENTIC_AI_AUDIT.md): 1 agent, 7 tools, model-chosen order, approval-gated | Ready |
| Agent traces | [docs/evidence/agent-traces](../docs/evidence/agent-traces): live S1 (recovery), S3 (malicious document), S4 (provider failure) pass; S2 (overloaded week) fails, fix shipped, not yet re-run live | ✅ Live, all 4 run |
| Tests | 231 unit · 173 integration · 81 end-to-end (production build), all passing locally on 5 Nov; CI on every push | Verified |
| Agent evaluation | [evals/REPORT.md](../evals/REPORT.md): 38 cases, **38 pass** on each case's latest real result; live tool selection 8/8 (4–5 Nov); every attempt, including quota failures, in [LIVE_AGENT_EVALUATION_REPORT.md](../LIVE_AGENT_EVALUATION_REPORT.md) | Verified (one run per case) |
| RAG evaluation | [evals/RAG_REPORT.md](../evals/RAG_REPORT.md): 51 questions over 3 synthetic courses, live embeddings, Recall@3 100%, Recall@1 94.1%, MRR 0.971, abstention 7/7 with no false abstentions; claim checker precision 1.0 / recall 1.0 on 30 labelled claims; cross-user isolation in [RAG_QUALITY_REPORT.md](../RAG_QUALITY_REPORT.md) | Verified |
| Security | [SECURITY_AUDIT.md](../SECURITY_AUDIT.md), [AI_SECURITY_RED_TEAM_REPORT.md](../AI_SECURITY_RED_TEAM_REPORT.md): no open Critical or High findings | Verified |
| Operations | [OBSERVABILITY_REPORT.md](../OBSERVABILITY_REPORT.md), [INCIDENT_RESPONSE_RUNBOOK.md](../INCIDENT_RESPONSE_RUNBOOK.md) | Ready |
| Usability pilot | [USER_VALIDATION_REPORT.md](../USER_VALIDATION_REPORT.md) + [docs/VOLUNTEER_KIT.md](../docs/VOLUNTEER_KIT.md) | **Not conducted** |
| Screenshots | `docs/screenshots/` (app) · `docs/evidence/production/` (live public pages, desktop and phone, light and dark) | Ready |
| iPhone app | `ios/` (built with Xcode, runs in the simulator) | Ready (not on the App Store) |
| Checkpoints | [DDS_CHECKPOINT_TRACKER.md](DDS_CHECKPOINT_TRACKER.md) | Day 0 not done |
| LinkedIn post | [social/LINKEDIN_POST.md](social/LINKEDIN_POST.md) | Draft; owner publishes |

Nothing in the public repo contains keys, real student data or personal documents (`outbox/` is git-ignored).
