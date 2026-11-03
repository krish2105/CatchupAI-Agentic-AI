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
| Agent traces | [docs/evidence/agent-traces](../docs/evidence/agent-traces): 4 scenarios (recovery, overload, malicious document, provider failure) | **Live traces pending the model key**; scripted plumbing traces only |
| Tests | 103 unit · 99 integration · 65 end-to-end (production build), all passing; CI on every push | Verified |
| Agent evaluation | [evals/REPORT.md](../evals/REPORT.md): 38 cases, 30 pass / 0 fail / **8 skipped (need the live model)** | Partial |
| RAG evaluation | [RAG_QUALITY_REPORT.md](../RAG_QUALITY_REPORT.md): Recall@3 90.9%, abstention 4/4, 0 cross-user leaks, deleted docs 0 results; claim checker precision 0.94 | Verified (keyword search) |
| Security | [SECURITY_AUDIT.md](../SECURITY_AUDIT.md), [AI_SECURITY_RED_TEAM_REPORT.md](../AI_SECURITY_RED_TEAM_REPORT.md): no open Critical or High findings | Verified |
| Operations | [OBSERVABILITY_REPORT.md](../OBSERVABILITY_REPORT.md), [INCIDENT_RESPONSE_RUNBOOK.md](../INCIDENT_RESPONSE_RUNBOOK.md) | Ready |
| Usability pilot | [USER_VALIDATION_REPORT.md](../USER_VALIDATION_REPORT.md) + [docs/VOLUNTEER_KIT.md](../docs/VOLUNTEER_KIT.md) | **Not conducted** |
| Screenshots | `docs/screenshots/` (app) · `docs/evidence/production/` (live public pages, desktop and phone, light and dark) | Ready |
| iPhone app | `ios/` (built with Xcode, runs in the simulator) | Ready (not on the App Store) |
| Checkpoints | [DDS_CHECKPOINT_TRACKER.md](DDS_CHECKPOINT_TRACKER.md) | Day 0 not done |
| LinkedIn post | [social/LINKEDIN_POST.md](social/LINKEDIN_POST.md) | Draft; owner publishes |

Nothing in the public repo contains keys, real student data or personal documents (`outbox/` is git-ignored).
