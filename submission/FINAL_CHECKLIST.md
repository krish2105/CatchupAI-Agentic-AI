# M8 release and submission checklist

Status is updated only with verified evidence (see BUILD_STATUS.md, QA_REPORT.md, evals/REPORT.md).

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Production build, type checks and critical tests pass | ✅ | typecheck, lint, unit, integration, E2E (production build) all green — see BUILD_STATUS execution log |
| Two-account security and RLS checks pass | ✅ | `tests/integration/*`, E2E cross-tenant suites, eval cases X1–X4 |
| Real agent calls, citations and approval flow verified | ⚠️ partial | Tools, citations, approval verified with the scripted model; **live OpenAI run pending your key** |
| Deployed URL works after a fresh browser session | ❌ | Needs Supabase cloud + Vercel (docs/DEPLOYMENT.md) |
| 30-case evaluation report contains actual results | ⚠️ partial | `evals/REPORT.md`: 25 pass, 0 fail, 5 tool-selection cases skipped until a model is configured |
| Demo recording and architecture explanation ready | ⚠️ partial | Script: docs/09_DEMO_SCRIPT.md; architecture in README; recording needs the live URL |
| GitHub README, screenshots and limitations | ✅ | README.md, docs/screenshots |
| Volunteer testing (3–5) | ❌ | Protocol: docs/USER_TESTING.md; needs the live URL |
| Official Nas.io submission and LinkedIn post | ❌ | Yours to submit; draft in submission/LINKEDIN_SHOWCASE_TEMPLATE.md |
