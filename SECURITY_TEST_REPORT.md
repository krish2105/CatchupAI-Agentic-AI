# Security test report · CatchUp AI

**Date:** 2026-11-04 · local Supabase (Docker), production build on :3100, Chromium.

## Commands and results
| Command | Result |
| --- | --- |
| `npm run typecheck` / `npm run lint` | PASS |
| `npm test` (unit) | 73 / 73 |
| `npm run test:integration` (real local Supabase) | 78 / 78 |
| `npm run test:e2e` (production build) | 55 / 55 (first run 54/55: command-palette test timed out once under load; passed 3/3 alone and in the full re-run) |
| `npm run eval` | 25 pass · 0 fail · 5 skipped (need a real LLM) |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Bundle scan for key material (`sb_secret_…`, `sk-…`) in `.next/static` | clean |

## Adversarial scenarios → tests
| Scenario | Test(s) | Result |
| --- | --- | --- |
| Unauthenticated API access | `rls.test.ts` (anon denied), E2E auth redirects | PASS |
| Cross-user rows, documents, signed links, direct URLs | `rls.test.ts`, `checklist.test.ts`, `teach.test.ts`, `data.spec.ts` | PASS |
| Forged IDs / `owner_id` / scores / weights | `rls.test.ts` (42501), `teach.test.ts`, `checklist.test.ts` | PASS |
| Expired, stale, replayed, concurrent approvals | `approval.test.ts`, `recovery.spec.ts` | PASS |
| Duplicate document processing | `rag.test.ts` (one of two wins, 409) | PASS |
| Malicious / oversized / scanned / encrypted PDFs | `rag.test.ts`, `documents.spec.ts` | PASS |
| Prompt injection inside course documents | `rag.test.ts`, `agent.test.ts`, eval | PASS (scripted model; live LLM untested) |
| Cross-user vector retrieval | `agent.test.ts`, eval X-cases | PASS |
| Cost exhaustion via demo accounts | `abuse.test.ts` | PASS |
| Rate-limit RPC abuse | `abuse.test.ts`, `rate-limit-sync.test.ts` | PASS |
| CSRF (cross-site Origin) | `security.spec.ts` | PASS |
| CSP present, nonce-only scripts, no violations | `security.spec.ts` (12 pages) | PASS |
| Rejected/rotated session token | `session.test.ts`, `http-errors.test.ts` | PASS |
| Secrets in client bundle | CI bundle scan | PASS (local) |

## Coverage gaps
- No live-LLM jailbreak or tool-selection testing (no API key).
- No dynamic scanner (DAST), fuzzing or load testing; no test of the hosted deployment.
- The CI workflow's first run on GitHub is the verification of the pipeline itself.
