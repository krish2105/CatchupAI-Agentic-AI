# Production readiness report

**Date:** 2026-11-04 · **Live URL:** https://catchupai-chi.vercel.app (deployed from `main` at `f40cc81`, CI green) · **Release candidate:** branch `m8-release` (not yet deployed; merging it needs the owner's approval)

## Deployment configuration (checked)
| Item | State |
| --- | --- |
| Vercel project `catchupai`, Hobby plan | Production auto-deploys from `main`. Agent route `maxDuration = 120`; crons daily (demo cleanup 03:00 UTC, nudges 02:30 UTC) |
| Supabase `keczcmggohfmgyjsdevk` (Seoul) | 14 migrations applied. **Migration 0015 (`ops_flags`, `mcp_usage`) is on this branch only**; apply it before or with the merge |
| Auth | Email code / magic link through custom Gmail SMTP; Turnstile CAPTCHA; anonymous sign-in for the demo |
| Storage | Private bucket, PDF only, 10 MB |
| Model access | **Not configured.** Gemini key not entered; the copilot shows "AI runtime not configured" |
| Study emails | Code deployed; SMTP env vars for the cron not set |
| Production build | `next build` succeeds locally and in CI |

## Live checks done by automation (public pages only)
`node scripts/capture-production-evidence.mjs`: `/`, `/login` and `/quality` at 1440 px and 390 px, light and dark (via
the OS colour scheme, i.e. **System** mode): **12/12** returned 200 with 0 px horizontal overflow and 0 page errors. Screenshots are in
[docs/evidence/production](docs/evidence/production). `scripts/uptime-check.mjs`: liveness, landing page with nonce
CSP, quality page, protected-route redirect and cron protection pass; readiness is 404 until this branch is deployed.

The live sign-in is protected by a human bot check (Turnstile), which automation must not solve. The owner signed in
on the live site with an emailed code and reached the Learning universe (screenshot shared in the session,
2026-11-04). A full signed-in journey **on production** has not been recorded by automation.

## Full student journey (local production build, `next build && next start`, synthetic data)
| # | Step | Result | Evidence (Playwright, `npm run test:e2e`: 65/65 passed) |
| --- | --- | --- | --- |
| 1 | Open app | ✅ | `shell.spec.ts`; production screenshots |
| 2 | Register / demo mode | ✅ | `auth.setup.ts` (real sign-up with the emailed code via Mailpit); demo tests |
| 3 | Create courses | ✅ | `data.spec.ts` |
| 4 | Upload material | ✅ | `documents.spec.ts` (indexed, 4 pages) |
| 5 | Cited answer | ✅ | `copilot.spec.ts` (page 2 citation, survives reload) |
| 6 | Copilot on missed learning | ✅ (scripted model) | `redesign.spec.ts` missed class rescue; **live model pending** |
| 7 | Three scenarios | ✅ | `recovery.spec.ts` |
| 8 | Feasibility and exact changes | ✅ | `redesign.spec.ts` "exact changes before approval" |
| 9 | Approve a valid plan | ✅ | `copilot.spec.ts`, `recovery.spec.ts`; infeasible plans refused |
| 10 | Persisted schedule | ✅ | reload checks in planner tests |
| 11 | Study / focus session | ✅ | `redesign.spec.ts` focus sanctuary (survives refresh) |
| 12 | Assessment | ✅ | `practice.spec.ts` |
| 13 | Insights update | ✅ | `practice.spec.ts`, weekly review and recovery score |
| 14 | Refresh persists state | ✅ | throughout |
| 15 | Log out blocks data | ✅ | `shell.spec.ts` "signing out ends the session"; API 401s in `security.spec.ts` |
| — | Phone and desktop, Light/Dark/System | ✅ | overflow at 320, 390, 1024 and 1440 px in both themes; System-theme test |
| — | Keyboard, reduced motion, 3D off, no WebGL | ✅ | `hardening.spec.ts`, `shell.spec.ts`; axe shows no serious or critical issues in either theme |

## Resilience
| Scenario | Behaviour | Evidence |
| --- | --- | --- |
| Model failure or timeout | Run marked failed, draft expired, clear message | `agent.test.ts`, eval B2 |
| Database interruption | Readiness 503; pages show an error state; the session-recovery path handles rejected tokens | readiness route, `session.test.ts` |
| Failed document processing | Marked failed with a code; retry claims it atomically (no double processing) | `rag.test.ts` |
| Refresh during a focus session | Resumes | E2E |
| Duplicate or concurrent approvals | 10 in parallel → 1 plan | eval A2 |
| Failed cron | Non-2xx plus log; nudges send at most once a day (`last_sent_on`) | `nudges.test.ts` |
| Interrupted deployment | Vercel keeps serving the previous deployment; promote the old one to roll back | runbook |
| Backup restore | Local drill: row counts identical | SECURITY_AUDIT.md |

## Release gates
| Gate | Status |
| --- | --- |
| Production build succeeds | ✅ |
| Required automated tests run and recorded | ✅ unit 100, integration 99, E2E 65, eval 30/0/8, RAG eval gates pass |
| Real model evaluation done, or the blocked cases named | ⚠️ **Blocked:** T1–T8 need the Gemini key |
| RAG citations checked against verified evidence | ✅ RAG_QUALITY_REPORT.md |
| Cross-user authorization tests pass | ✅ |
| No unresolved Critical or High security issue | ✅ (H-2 fixed on this branch) |
| Agent can't bypass approval | ✅ |
| Core workflows on the deployed app | ⚠️ Public pages verified; signed-in flow verified once by the owner; full automated journey on the local production build |
| Error monitoring and operational checks | ⚠️ Structured logs, readiness and uptime alerts on this branch; no error-tracking service (Sentry needs the owner's account) |
| Desktop, mobile and themes | ✅ |

## Go / no-go
**NO-GO to call M8 complete.** One mandatory gate is blocked: the live model evaluation, which needs the Gemini key. Two
more need the owner: approval to merge `m8-release` (deploys it and needs migration 0015 in production), and an optional
Sentry account.

**GO for a public demo of the current deployment**, provided the copilot is presented honestly: it shows "AI runtime not
configured" live, and the recorded video uses the labelled scripted test model.
