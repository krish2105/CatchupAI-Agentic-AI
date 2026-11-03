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
| Planner scenarios + approval | Not started | M4 (only `assessCapacity` util exists) |
| Agent + tools | Not started | M5 |
| Universe data / insights / quiz | Not started | M6 |
| Deployment / submission | Not performed | needs user approval + cloud accounts |

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

