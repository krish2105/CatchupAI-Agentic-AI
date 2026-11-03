# QA report · CatchUp AI

**Date:** 2026-11-03 (updated after Nature Flow 3.0 and M8 preparation) · **Environment:** macOS, Node 26.10.0, Supabase CLI 2.116.0 (local Docker stack, Postgres 17), Chromium (Playwright 1.64).

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0) |
| `npm test` (Vitest unit) | **56 / 56 passed** (9 files) |
| `npm run test:integration` (real local Supabase) | **66 / 66 passed** (7 files) |
| `npm run test:e2e` (Playwright vs `next build && next start -p 3100`) | **49 / 49 passed** (includes production build) |
| `npm run eval` (30-case evaluation, see `evals/REPORT.md`) | **25 passed · 0 failed · 5 skipped** (tool-selection cases need a real LLM; not simulated) |
| Secret scan (tracked files + `.next/static`) against the real local secret values and key patterns | 0 hits |

Nothing was skipped. No test hard-codes a passing result for missing behaviour.

## What the suites cover

**Access control (integration + E2E):** two real users; cross-tenant reads, updates, deletes and inserts blocked on every table (including via direct API URLs, which return 404); `owner_id` spoofing rejected (42501); anonymous access denied; server-owned tables not writable by students; quiz answer keys unreadable; storage upload restricted to the exact pending-document path; other tenants' files can't be downloaded, listed, signed or written; non-PDF MIME rejected by the bucket.

**Documents and RAG:** page extraction; rejection of non-PDF, empty, scanned (no text), >50-page, truncated and >10 MB files; idempotent processing; exactly one of two concurrent processing requests wins (409); duplicate files; correct page citation ("residual" → p. 2); abstention on unrelated questions; prompt-injection text stored and returned as inert data.

**Planner and approval:** time-zone/DST windows, midnight wrap, ≤90-minute blocks with breaks, EDF ordering, honest shortfall, 200 randomized invariant runs (no overlap, inside windows, before deadlines, minutes conserved); proposals are server-created; approval is idempotent across retries and **10 concurrent requests create exactly one plan**; reject saves nothing; expired, stale (inputs changed) and infeasible proposals are refused; another student can't approve, reject or read a proposal; a double-click approval in the UI creates one plan.

**Agent:** only five read-or-draft tools exist; the real tool chain runs with a scripted model; facts citing unretrieved sources are removed; another student's course id is denied without leaking data; drafts must cite retrieved evidence; model failure → failed run and expired draft; turn and search budgets enforced; runs are private. E2E: live SSE timeline, page citation, persistence after reload, draft → lab → approve → planner evidence link.

**UX and accessibility:** navigation across all nine screens; theme persistence (light/dark/system); mobile drawer focus handling; no horizontal overflow at 320/390/720 (200% zoom)/1024/1440 px in both themes; axe (WCAG 2.0/2.1 A/AA) with no serious or critical violations on all pages in both themes; no-WebGL and 3D-off fallbacks; the approval loop completed using only the keyboard with reduced motion and 3D off.

**Evaluation finding fixed:** case R2 ("explain the intercept and slope…") initially abstained although page 1 contains the answer. Measurement showed lexical rank alone rejects short relevant questions (one-word queries ≈ 0.03 < 0.08) while unrelated queries score exactly 0. Retrieval now also uses query-term coverage (≥ ⅓ of meaningful terms present; migration `20261103000006`), and both abstention cases still pass.

## Known gaps (not tested)

- **Live OpenAI agent and embedding calls**: no API key was available. The code path exists (`openAiRuntime()`, `getEmbedder()`), but no live call has been executed.
- Real screen readers (VoiceOver/NVDA) and physical mobile devices were not tested; axe and keyboard tests are automated proxies.
- Load or performance testing and a hosted deployment smoke test were not done.
- No Content-Security-Policy header yet.

## Defects found and fixed during this build (selection)

| Area | Defect | Fix |
| --- | --- | --- |
| Starter | Lint errors (setState in effect) | `useSyncExternalStore` preferences store |
| 3D | drei `<Html>` crashed on navigation under React 19.3 | removed drei; projected DOM labels |
| 3D | geometry not rendered (`useFrame` positive priority disables auto-render) | default priority |
| A11y | reference tokens failed AA contrast | raised `--faint/--muted/--good/--warn/--coral` |
| Planner | a deadline-limited item wasted the rest of a shared study window | break without advancing the window |
| Planner | what-if save left the slider out of sync (per-day rounding) | sync to saved total |
| Agent | cited copilot items outranked by generic review items in "essential" | agent items rank first |
| Quiz | headings and wrapped lines produced broken questions | heading filter, line re-join |
| Syllabus import | wrapped PDF lines split dates from titles; trailing dots kept | line unwrapping, cleanup loop (tested on the real fixture PDF) |
| Retrieval | short relevant questions abstained (rank-only threshold) | lexical coverage evidence rule |
| UI | hero card hidden behind landscape art; dark islands too dark; week grid wasted hours | stacking, palette, fitted hours |
