# CatchUp AI implementation status

**Last updated:** 2026-11-03 (build session). Milestone plan: M0 env → M1 frontend → M2 auth/RLS → M3 RAG → M4 planner/approval → M5 agent → M6 universe/insights/quiz → M7 hardening.

**Session decisions:** local Supabase (Docker) first; OpenAI runtime kept but **no API key yet** — agent/embeddings are built and tested with injected fakes, live model runs are unverified until a key is added; git commit per verified milestone, never pushed.

## Current state

| Area | State | Evidence |
| --- | --- | --- |
| M0 dependencies, lockfile, git | Done | `package-lock.json`; Next 16.4.4, React 19.3.1, R3F 9.8.2, three 0.187, @supabase/ssr 0.12.7, @openai/agents 0.21.0, zod 4.6, TS 6.0.3 |
| M0 typecheck / lint / build / unit tests | Passing | see log 2026-11-03 |
| Preferences store (theme light/dark/system, motion, 3D) | Done (local) | `src/lib/preferences/*`, pre-paint script, verified reload persistence |
| Nine-route Orbital Atelier UI (M1) | Done — shell, design system, all 9 routes + 404/loading/error, honest empty states (no sample data) | `npm run test:e2e` 18/18 |
| R3F scene (dashboard orb + universe) | Done — data-driven props, DOM topic list, arrow-key/drag rotation, offscreen pause, demand frameloop for reduced motion/mobile, 3D-off + no-WebGL fallback | E2E fallback test; manual browser check both themes |
| Auth (passwordless email code + magic link), proxy session refresh, onboarding | Done (local) | E2E setup signs up via real UI + Mailpit code |
| Schema + RLS + grants + private storage (M2) | Done (local) — composite owner FKs, column grants, server-owned tables SELECT-only, generated storage paths, PDF-only 10 MB bucket | `npm run test:integration` 24/24 |
| Courses / assignments / profile CRUD + APIs | Done — Zod strict validation, structured errors, per-user DB rate limits, timezone-correct due dates | E2E CRUD + cross-tenant API tests |
| Synthetic demo seed | Done — `npm run seed:demo -- --email ...` (local only by default) | manual run |
| PDF upload + ingestion (M3) | Done — browser → private storage (path bound to a pending document row), server validation (magic bytes, 10 MB, 50 pages, encrypted, no-text), page-faithful chunking, sha256 dedupe, atomic claim (no double processing), retry | integration + E2E |
| Retrieval / evidence search | Done — hybrid lexical + vector RRF (`search_course_chunks`, SECURITY INVOKER), owner+course scoped, evidence threshold → abstain, signed 2-min source links at the cited page | integration + E2E |
| Embeddings | Implemented (OpenAI `text-embedding-3-small`, 1536-d); **live calls unverified — no API key**. Without a key documents index lexically and search still works | fake embedder in tests |
| Deterministic planner (M4) | Done — `src/lib/planner/engine.ts`: tz/DST-safe daily windows, EDF scheduling, ≤90-min blocks + 10-min breaks, 3 nested scenarios, shortfall + capacity-before-deadline, overdue work reported not scheduled | 19 engine unit tests incl. 200 randomized invariant runs |
| Recovery lab + approval gate | Done — server-computed scenarios, what-if slider (must save before approving), server-created pending proposals (6 h TTL), `approve_proposal` RPC (row lock, idempotent, stale/expired/infeasible refused, deadline check, supersedes old plan), reject | integration (12) + E2E (5) |
| Study schedule + dashboard outlook | Done — active plan by local day, completion persists, dashboard coverage/trajectory/today's focus from real data | E2E |
| LearningRecoveryAgent (M5) | Done — OpenAI Agents SDK 0.21 `Runner`, 5 typed tools (`get_study_preferences`, `list_assignments`, `search_course_material`, `get_learning_progress`, `draft_recovery_plan`), trusted context from verified session, ownership check in every tool, search/draft budgets, maxTurns 8, 90 s timeout, structured answer (facts with source ids vs suggestions), unsupported facts removed, failed runs expire drafts | integration 9 + E2E 2 with a scripted model |
| Real tool timeline + persisted trace | Done — events recorded inside tool wrappers, streamed over SSE, stored in `agent_runs` (privacy-safe args) | E2E reload check |
| **Live OpenAI agent runs** | **Unverified — no `OPENAI_API_KEY`/`OPENAI_MODEL` provided.** Code path `openAiRuntime()` exists; no live call has been made | needs your key |
| Learning universe data | Done — nodes = the student's courses; satellites = their assignments/documents; status/progress from overdue work and active-plan completion only | unit + E2E |
| Knowledge checks (P1, M6) | Done — deterministic cloze questions from the student's indexed sentences, each with document/page evidence; answer keys in server-only `quiz_keys`; server grading; attempts persisted; weak terms surfaced. **Not LLM-generated** (no key) | unit 4 + integration 5 + E2E |
| Insights (M6) | Done — latest quiz, blocks/minutes completed, active plan, 14-day minutes chart (validated palette, tooltip, table view), topic results, per-course progress; all from persisted rows | E2E |
| Hardening (M7) | Done — security headers, `no-store` API caching, no-WebGL/200%-zoom/keyboard-only tests, secret scan, README + `QA_REPORT.md` | E2E 41/41 |
| Nature Flow 3.0 redesign — R1/R2 | Done: alpine-morning / moonlit-forest tokens (AA-checked), Fraunces + Manrope type, brand mark, theme-aware SVG landscape, Mission Control briefing from real data, one-click Missed Class Rescue, ⌘K command palette, universe label fix | E2E 43/43 ×2 |
| Nature Flow 3.0 — R3 Recovery Lab | Done: 7-day route timelines from engine output (bars + due markers, accessible summary), "exact changes before approval" (+ adds / − cancels / = keeps) | E2E |
| Nature Flow 3.0 — R4 Focus Sanctuary | Done: wall-clock timer (25/50 min), sessions saved to `focus_sessions` (RLS, composite owner FK, duration integrity checks), optional block completion, dashboard "Focus sprint" | integration 3 + E2E |
| Nature Flow 3.0 — reference alignment (S1–S4) | Done: bold sans headings, mint nav pill + pine-ridge sidebar, richer landscape, Mission Control briefing card + hero stats + suggested next steps + 7-day progress line; routes renamed Deadline first / Balanced / Full recovery with an explained "Recommended" rule and per-day load; Study Schedule week grid (time-zone positioned blocks, deadlines, week navigation, checkbox toggles) + list view; Knowledge Vault landscape course cards + recent documents; **Smart Syllabus Import** (deterministic extraction, editable review, nothing saved before confirm) | unit 52, E2E 46 |
| Nature Flow 3.0 — S5 Preferences + privacy | Done: theme cards (Alpine morning / Moonlit forest / System), accessibility notes, **data export (JSON)** and **account deletion** (typed confirmation, files + cascade); Insights shows focus time | E2E |
| Nature Flow 3.0 — S6 Learning universe | Done: low-poly floating islands (one per course; lushness = real plan progress, autumn tint = overdue required work), pines = documents, stones = assignments, central great tree, dashed path in next-deadline order (explicitly not prerequisites), labels above islands, inspector lists landmarks with actions; DOM fallback unchanged | browser review + E2E fallback |
| Practice: spaced revision + adaptive retests + baseline vs latest | Done (deterministic, from graded attempts) | unit 4 + integration |
| One-click judge demo | Done: anonymous sign-in (Turnstile-ready), synthetic seed through RLS incl. indexed PDF, demo banner, POST leave, daily cleanup cron (CRON_SECRET) | integration 2 + E2E 2 |
| 30-case evaluation | Done: `npm run eval` → `evals/REPORT.md` — **25 pass · 0 fail · 5 skipped** (tool selection needs a real LLM) | eval run |
| Deployment preparation | Done: docs/DEPLOYMENT.md, vercel.json cron, `.env.example`, `npm run preflight` (local PASS; `--production` correctly fails 6 checks until configured) | preflight run |
| Submission pack | Done: demo script, user-testing protocol, LinkedIn draft, M8 checklist (submission/) | — |
| Session recovery | Done: a token the database rejects (expired / rotated signing key) renews via /auth/refresh instead of an error page; local signing key pinned | unit 4 + integration 1 |
| Nature Flow 3.0 visual pass | Done: photographic WebP panoramas (light/dark), Fraunces display type, Mission Control, Recovery Lab cards + exact changes, Copilot answer + decision card, Focus panorama + opt-in sound, Universe 3D/List + label cards, notifications bell, phone bottom nav | E2E 49 + manual screenshots 1440/390, light/dark |
| Smart recovery replanner | Done: completed block minutes subtracted per assignment (any plan); missed blocks → Mission Control card, bell notice, /recovery?replan=1 explanation; approval still required | unit 3 + E2E 1 |
| Focus sanctuary landscapes + session recovery | Done: theme-specific WebP (only visible one loads), ring timer, reset/play/end controls, local session resume after refresh | E2E (resume after reload) |
| Dark theme: Forest at night (user-selected option B) | Done: tokens AA-checked (worst text pair 5.5:1), outlined cards, pale-mint primary | E2E axe both themes |
| Deployment / submission | **Not performed** — blocked on your accounts (Supabase/Vercel logins, OpenAI key, Resend, Turnstile) | docs/DEPLOYMENT.md |

## M0 audit findings
- `^0.x` ranges froze stale versions (`@openai/agents ^0.3`, `@supabase/ssr ^0.6`, `three ^0.175`); `openai ^6` conflicted with Agents SDK 0.21 (`openai ^7.2`). All updated and pinned.
- TypeScript `latest` is 7.0 (native compiler); pinned `~6.0.3` for Next.js type-check compatibility.
- Starter failed lint: 2 × `react-hooks/set-state-in-effect` in `theme-toggle.tsx`/`agent-orb.tsx`. Fixed by a `useSyncExternalStore` preferences store.
- Next 16 renamed `middleware` → `proxy` (confirmed in bundled `node_modules/next/dist/docs`). Use `src/proxy.ts` for Supabase session refresh.
- Draft migration gaps to fix in M2: no profile trigger/availability columns; no safe write path for agent runs/proposals (must not be user-insertable); no approval transaction; `study_tasks.course_id` unchecked; anon grants not revoked; bucket lacks size/MIME limits; `embedding NOT NULL` blocks keyless ingest; no `updated_at` staleness; no rate-limit storage.
- Reference HTML: overlapping orb labels and a clipped bottom node label are not copied (labels are now projected and clamped). Correction: the "sidebar stops at 900px" look was a full-page screenshot artifact; the sidebar is `position:fixed`.
- Reference `--faint`/`--muted` (both themes) and light `--good`/`--warn`/`--coral` failed WCAG AA for small text; raised in `globals.css` (axe now clean).

## History (starter pack)

### Original pack notes

**Pack updated:** 2026-11-03. This ZIP contains an implementation *starter*; the end-to-end production app is not yet built.

| Component | State in this ZIP | What had to be verified/implemented |
| --- | --- | --- |
| Product/architecture/API/agent/RAG/3D docs | Prepared | Validate with installed libraries and actual integration |
| Standalone HTML interaction prototype | Present | Browser simulation only; translate into real Next.js pages |
| Desktop/mobile HTML previews | Present | Screenshots of design prototype, not production |
| Next.js landing + native R3F orb | Source present | npm install/build/browser QA and production UI route integration |
| Deterministic capacity utility | Source present | Extend scheduling/overlap/timezone tests and service |
| `/api/health` endpoint | Source present | Verify after install/build/deploy |
| Supabase migration draft | Source present | Test/review RLS, grants, vector policy and Storage, apply with authorization |
| Authentication/course/assignment CRUD | Not implemented | P0 |
| Real file uploads, PDF processing and RAG | Not implemented | P0 |
| Real agent SDK and tools/events | Not implemented | P0 |
| Proposal approval and DB persistence | Not implemented | P0 |
| Quizzes and analytics backed by persisted data | Not implemented | P1 |
| Production build, security integration/E2E | Not performed in this pack conversion | Implement, run and log results |
| Hosting / official hackathon submission | Not performed | Needs user services, consent and participant account |

## Verified file-pack conversion operations (not production tests)
- Original 2026-11-03 Work starter copied into the starter pack, previous Work-specific prompts replaced.
- Interactive stand-alone HTML and actual desktop/mobile screenshots copied into `design-reference/`.
- Exact ZIP/archive and document link verification should be recorded after packaging below.

## Prior visual starter checks (source pack)
Original starter author recorded that JSON files parsed, TS/TSX syntax checks were clean, and a capacity calculator passed four direct checks; **not reproduced as full npm tests here**. Previous browser prototype creator reported rendering and click-through checks. Do not infer a working Next.js app from those facts.

## Execution log
| Date | Slice | Command/action | Result | Remaining blocker |
| --- | --- | --- | --- | --- |
| 2026-11-03 | Packaging | Docs + HTML copied into the starter pack | Prepared; archive verification pending | No live services |
| 2026-11-03 | Offline verification | `python3 scripts/verify_starter.py` | PASS: 37 required files, JSON, HTML screen markers, basic checks | Real Next.js build not tested |
| 2026-11-03 | HTML syntax | `node --check` on extracted HTML `<script>` | PASS: no JS syntax error | Browser flow still not retested as live backend |
| 2026-11-03 | Capacity unit smoke | Global `tsc` compilation and 4 direct Node assertions | PASS: 4/4 | Full Vitest suite not set up |
| 2026-11-03 | Dependencies | `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | TIMEOUT during registry resolution; no package-lock created | Install/pin compatible versions and run build/tests |

## Orbital Atelier V2 (2026-11-03)
- NEW: self-contained nine-screen reference `design-reference/CatchUp_AI_Orbital_Atelier.html`, with 3D perspective canvas, full dark/light theme toggle, working nav, prototype assistant, recovery scenarios, approval, planner, quiz, insight view and preferences. **All sample student/AI activity is simulated; no real backend connection.**
- NEW: `public/orbital-atelier-preview.html` serves the standalone design through Next.js if dev server installs.
- NEW: basic Next.js landing theme toggle and palette updates; actual nine-screen production routes, R3F universe data binding, real Supabase/OpenAI API tools and deployment are still NOT done.
- QA performed on standalone HTML with Chromium via set_content: 20/20 automated interaction assertions passed, zero JavaScript page errors, extracted script passed node --check. Browser navigation to localhost/file was blocked by environment policy; test harness used set_content instead.
- No complete Next.js npm install, typecheck, lint, production build, hosted deployment or RLS integration tests verified for this V2 update. Do not claim they passed.
- Next: implement real P0 backend in vertical slices and port canonical design into Next.js.

- Additional responsive QA: 90 screen/theme/viewport combinations across widths 320, 390, 768, 1024 and 1440 passed without horizontal overflow after correcting a narrow header case.
| 2026-11-03 | M0 | `git init` + baseline commit of untouched starter | PASS | — |
| 2026-11-03 | M0 | `npm install` (480 packages) | PASS; npm warns eslint 9 is end-of-life (kept for eslint-config-next 16 compatibility) | — |
| 2026-11-03 | M0 | `npm run typecheck` | PASS | — |
| 2026-11-03 | M0 | `npm run lint` | FAIL (2 react-hooks errors) → fixed → PASS | — |
| 2026-11-03 | M0 | `npm test` (Vitest, `tests/unit/capacity.test.ts`) | PASS 6/6 | — |
| 2026-11-03 | M0 | `npm run build` | PASS (`/`, `/api/health`) | — |
| 2026-11-03 | M0 | Browser pane: `npm run dev`, load `/`, toggle theme, reload, fetch `/api/health` | PASS: light theme persisted, WebGL orb rendered, health JSON ok, zero console errors | — |
| 2026-11-03 | M1 | `npm run typecheck`, `npm run lint` | PASS (fixed 3 `react-hooks/immutability` errors via `SceneController`) | — |
| 2026-11-03 | M1 | Browser pane: drei `<Html>` labels threw React 19 `removeChild`/unmount errors on navigation | FIXED: removed drei, labels are a projected DOM overlay | — |
| 2026-11-03 | M1 | Browser pane: WebGL geometry not drawn | FIXED: `useFrame` positive priority disabled auto-render | — |
| 2026-11-03 | M1 | `npx playwright test` (first run) | 15/18; axe contrast failures + drawer focus return | fixed |
| 2026-11-03 | M1 | `npx playwright test` | PASS 18/18: 9-route nav + aria-current, theme persistence across real reload, system theme, 3D-off fallback, motion pref, mobile drawer (Esc + focus return), 404, no overflow at 320/390/1024/1440 × dark/light × 10 pages, axe wcag2a/aa no serious/critical × 10 pages × 2 themes | — |
| 2026-11-03 | M1 | `npm test`, `npm run build` | PASS (6/6; 12 routes, AI-status pages dynamic) | — |
| 2026-11-03 | M2 | `supabase start` (Docker) + `supabase db reset` | PASS: migration `20261103000001_core_schema.sql` applied | — |
| 2026-11-03 | M2 | `npm run test:integration` | PASS 24/24 (two real users: profile isolation, cross-tenant read/update/delete/insert blocked, owner_id spoof 42501, anon denied, server-owned tables 42501, generated storage path, rate limit, storage path/MIME/cross-folder denial) | — |
| 2026-11-03 | M2 | Browser pane: /dashboard → /login → emailed code (Mailpit) → dashboard with seeded data | PASS | — |
| 2026-11-03 | M2 | `npx playwright test` | PASS 25/25 (adds signed-out redirect + 401, open-redirect refusal, UI course/assignment CRUD + reload persistence + UTC instant check, strict validation 400/413, cross-tenant direct API URLs 404, sign out) | — |
| 2026-11-03 | M2 | `npm run typecheck`, `lint`, `test` (14/14), `build` | PASS | — |
| 2026-11-03 | M3 | `supabase migration up` (`20261103000002_hybrid_search.sql`) | PASS | — |
| 2026-11-03 | M3 | `npm test` | 2 FAIL (`pdf.destroy` missing in bundled pdf.js) → fixed → PASS 20/20 (page extraction, not-PDF/empty/no-text/51 pages/truncated/>10 MB, chunk boundaries + overlap) | — |
| 2026-11-03 | M3 | `npm run test:integration` | PASS 34/34 (adds: 4-page ingest with exact page metadata, idempotent re-run, 1-of-2 concurrent claim (409), duplicate file, no-text + disguised HTML, cross-tenant processing 404, page-2 citation for "residual", page-3 lexical citation, abstain on unrelated query, cross-tenant search/RPC/chunk reads empty, injection text inert) | — |
| 2026-11-03 | M3 | `npx playwright test` | PASS 29/29 (adds: UI upload → "Indexed · 4 pages" → cited search p.2 → signed source redirect returns %PDF → abstain; no-text failure reason; non-PDF/oversize 400; other tenant's document get/process/source/delete/search/plant → 404) | — |
| 2026-11-03 | M3 | `typecheck`, `lint`, `build` | PASS | — |
| 2026-11-03 | M4 | `supabase migration up` (`20261103000003_proposal_approval.sql`) | PASS | — |
| 2026-11-03 | M4 | `npm test` | PASS 39/39 (engine: windows/DST/midnight wrap, block splitting, honest shortfall, EDF, deadline-limited window reuse (bug found and fixed before tests), breaks, nested scenarios, overdue, randomized invariants ×200, horizon, validation, what-if scaling, capacity before deadline) | — |
| 2026-11-03 | M4 | `npm run test:integration` | PASS 46/46 (adds: pending server-created proposals, single pending, idempotent approve, 10 concurrent approvals → 1 plan, supersede/cancel, reject → no tasks, expired, stale after edit, infeasible, cross-tenant approve/reject/read, anon RPC denied, task completion vs edit/cancel/other tenant) | — |
| 2026-11-03 | M4 | `npx playwright test` | 1 FAIL (slider stayed in what-if after save due to per-day rounding) → fixed → PASS 33/33 (adds: lab → approve via double click → 1 plan, reload, complete task persists, dashboard milestone; reject saves nothing; overload shortfall + disabled approve + what-if/save; API 409 infeasible; missing idempotency key 400; cross-tenant proposal 404) | — |
| 2026-11-03 | M4 | `typecheck` (1 test-helper null check fixed), `lint`, `build` | PASS | — |
| 2026-11-03 | M5 | `npm run test:integration` | 1 FAIL (agent study item outranked by heuristic review in essential route) → fixed ordering → PASS 55/55 (adds 9 agent tests: five non-committing tools; real tool chain with page-2 citation, unsupported fact removed, untrusted wrapper, pending draft linked to run, no tasks, persisted trace/tokens; forged other-tenant course denied with no leak; uncited draft denied; injection inert; model failure → failed run + expired draft; maxTurns stop; search budget; run privacy) | — |
| 2026-11-03 | M5 | `npm test` | PASS 43/43 (adds runtime gating: scripted model never with non-local Supabase or without flag; OpenAI needs key+model; answer verification) | — |
| 2026-11-03 | M5 | `npx playwright test` (now against `next build && next start -p 3100`, `CATCHUP_TEST_MODEL=scripted`) | PASS 35/35 (adds copilot: upload → ask → 4 live tool events → p.2 citation → reload persists → review in lab → approve → planner evidence link; abstain without evidence; forged course 404; invalid body 400) | — |
| 2026-11-03 | M5 | Browser pane (dev, no key): /assistant shows "AI runtime not configured", composer hidden | PASS | OpenAI key |
| 2026-11-03 | M6 | `supabase migration up` (`20261103000004_quiz_keys.sql`) | PASS | — |
| 2026-11-03 | M6 | `npm test` | PASS 47/47 (adds cloze: grounded questions/answers on the cited page, determinism per seed, no-material, grading). Quality reviewed by printing a generated quiz; heading-fragment and wrapped-line issues fixed | — |
| 2026-11-03 | M6 | `npm run test:integration` | PASS 60/60 (adds quiz: no answer keys in student-readable rows, `quiz_keys` 42501 for students, server grading + attempt, incomplete answers 400, cross-tenant 404s, attempt insert 42501, insufficient material 409) | — |
| 2026-11-03 | M6 | `npx playwright test` | PASS 36/36 (adds upload → generate → answer 5 → sourced results → previous checks → insights score/topic/chart) | — |
| 2026-11-03 | M6 | dataviz palette validator | dark `#8a7cf0` and light `#385fba` pass lightness/chroma/3:1 (lime accent failed lightness band, not used for bars) | — |
| 2026-11-03 | M7 | Security headers + hardening E2E (headers, health leaks nothing, no-WebGL, 200% zoom, keyboard-only approval with reduced motion + 3D off) | PASS 6/6 | — |
| 2026-11-03 | M7 | Secret scan: tracked files + `.next/static` vs real local secret values and key patterns | 0 hits | — |
| 2026-11-03 | M7 | Final: `typecheck`, `lint`, `npm test` 47/47, `test:integration` 60/60, `test:e2e` 41/41 (production build) | PASS | — |

## Next steps (need you)
1. **OpenAI:** add `OPENAI_API_KEY` + `OPENAI_MODEL` to `.env.local`, then run the copilot once and re-check the evidence thresholds (`EVIDENCE_THRESHOLD` in `src/lib/rag/retrieve.ts`) with real embeddings. Record the result here.
2. **Deploy (approval required):** create a Supabase cloud project (`supabase link` + `supabase db push`), a Vercel project with the env vars (server-only `SUPABASE_SECRET_KEY`), set Auth site URL/redirects and SMTP, then smoke-test the live URL on desktop and mobile.
3. **Submission:** confirm the Nas.io Day 8 form fields, deadline and time zone; record a 2–4 min demo from the real app (see docs/09_DEMO_SCRIPT.md).
| 2026-11-03 | R1/R2 | Token contrast script (all text/accent tokens ≥ 4.5:1 on every surface, both themes); dataviz validator for chart greens (light #1E8A66, dark #22A47B) | PASS | — |
| 2026-11-03 | R1/R2 | `npx playwright test` | first run 1 FAIL (selector collision with new search pill) → fixed; then rescue tool count (4: course-scoped search) and upload hydration waits; then a parallel-run flake traced to the shared-session sign-out test → isolated with its own student | — |
| 2026-11-03 | R1/R2 | `typecheck`, `lint`, `npm test` 47/47, `test:integration` 60/60, `test:e2e` 43/43 (two consecutive runs; adds command palette + mission control briefing + one-click rescue) | PASS | — |
| 2026-11-03 | R3/R4 | `supabase migration up` (`20261103000005_focus_sessions.sql`) | PASS | — |
| 2026-11-03 | R3/R4 | `typecheck`, `lint`, `npm test` 47/47, `test:integration` 63/63 (adds focus: completion + block done, duration/start-time integrity, cross-tenant block link 404, owner spoof 42501, read isolation), `test:e2e` 45/45 (adds focus timer save + API block completion + invalid session 400; route timelines + exact-changes list) | PASS | — |
| 2026-11-03 | S1–S4 | Syllabus extractor tests on clean text AND on the real fixture PDF (found wrapped-line and trailing-dot defects, fixed) | PASS | — |
| 2026-11-03 | S1–S4 | Browser review: briefing card hidden behind landscape art (stacking) and 3+1 next-step wrap — fixed | PASS | — |
| 2026-11-03 | S1–S4 | `typecheck`, `lint`, `npm test` 52/52, `test:integration` 63/63, `test:e2e` 46/46 | PASS | — |
| 2026-11-03 | S5/S6 | Browser review: dark islands too dark, week grid wasted hours, sidebar footer over ridge art, row spacing — all fixed; README screenshots recaptured from the redesigned app | PASS | — |
| 2026-11-03 | S5/S6 | `typecheck`, `lint`, `npm test` 52/52, `test:integration` 63/63, `test:e2e` 47/47 (adds privacy export/delete) | PASS | — |
| 2026-11-03 | M8 prep | `supabase migration up` (`20261103000006_search_coverage.sql`); local Supabase restarted with anonymous sign-ins | PASS | — |
| 2026-11-03 | M8 prep | `npm run eval` first run: 24 pass, **1 fail (R2 abstained)** → measured ranks, added coverage evidence → 25 pass, 0 fail, 5 skipped | PASS | OpenAI key for T1–T5 |
| 2026-11-03 | M8 prep | `npm run preflight` (local PASS; `--production` 6 required checks fail as expected) | PASS | production env |
| 2026-11-03 | M8 prep | `typecheck`, `lint`, `npm test` 56/56, `test:integration` 66/66, `test:e2e` 49/49 | PASS | — |
| 2026-11-03 | Fix | "This view couldn't load": cause = local signing key rotated on restart while the app's JWKS cache still accepted the old token (PostgREST 401). Added PGRST301-303 → session_expired, /auth/refresh recovery, pinned key | PASS (reproduced and recovered in browser) | — |
| 2026-11-03 | Nature Flow 3.0 | `typecheck`, `lint`, `npm test` 60/60, `test:integration` 67/67, `test:e2e` 49/49 (first run 48/49: duplicate accessible name "Exact changes before approval" → renamed lab list) | PASS | — |
| 2026-11-03 | Enhancement | Audit of the 10 requested features → docs/SCORECARD_AND_ROADMAP_95.md (score 76/100) | — | — |
| 2026-11-03 | Enhancement | Mobile/desktop audit: 0 overflow on 10 screens at 390 px; fixed clipped breadcrumb, two-tone headings, focus image band | PASS | — |
| 2026-11-03 | Enhancement | `typecheck`, `lint`, `npm test` 63/63, `test:integration` 67/67, `test:e2e` 50/50, `npm run eval` 25 pass / 0 fail / 5 skipped | PASS | OpenAI key for 5 eval cases |

