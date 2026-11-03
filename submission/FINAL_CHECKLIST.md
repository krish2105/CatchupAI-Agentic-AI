# M8 release and submission checklist

Status is updated only with verified evidence (BUILD_STATUS.md, PRODUCTION_READINESS_REPORT.md, evals/). Last update 2026-11-04.

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Production build, type checks and critical tests pass | ✅ | unit 100, integration 99, E2E 65 (production build), CI on every push |
| Two-account security and RLS checks pass | ✅ | integration suites, E2E cross-tenant tests, eval X1–X4, RAG cross-user 0 |
| Real agent calls, citations and approval flow | ⚠️ | Verified with the scripted model; **live model: enter the Gemini key** (`python3 scripts/configure-ai.py`), then `npm run eval` |
| Deployed URL works after a fresh browser session | ✅ | https://catchupai-chi.vercel.app; public pages 12/12; owner signed in live |
| Evaluation report with actual results | ✅ (partial coverage) | evals/REPORT.md 30/0/8 skipped; LIVE_AGENT_EVALUATION_REPORT.md; RAG_QUALITY_REPORT.md |
| Release branch `m8-release` merged and deployed | ⏳ | Needs your approval (applies migration 0015 in production) |
| Demo recording and architecture explanation | ✅ | demo/out/catchup-ai-demo.mp4 (2:13, captioned); submission/PROJECT_PACKAGE.md; DEMO_VIDEO_SCRIPT.md |
| README, screenshots and limitations | ✅ | README.md, docs/screenshots, docs/evidence/production |
| Volunteer testing (3–5) | ❌ Not conducted | USER_VALIDATION_REPORT.md, docs/VOLUNTEER_KIT.md |
| Error monitoring | ⚠️ | Logs, readiness and uptime alerts on the branch; Sentry needs your account |
| Day 0 and checkpoint forms on Nas.io | ❓ | Can't be checked without your login: confirm in the portal |
| Exact Day 8 deadline and time zone | ❓ | Public page shows Nov 14 05:00 without a time zone: confirm in the portal |
| Final Nas.io submission | ❌ | Yours to submit (form answers: SUBMISSION_FORM_ANSWERS_TEMPLATE.md) |
| LinkedIn post | ❌ | Draft: LINKEDIN_POST_DRAFT.md; publish yourself |
