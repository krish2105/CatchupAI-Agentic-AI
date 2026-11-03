# Architecture Decision Log

| ID | Decision | Reason | Status |
|---|---|---|---|
| ADR-001 | Single Next.js TypeScript deployable | Fast MVP, one source of truth for backend+UI | Accepted |
| ADR-002 | Supabase Auth, private Storage, Postgres/RLS and pgvector | Integrated ownership/storage/retrieval; minimize infrastructure | Accepted; implementation pending |
| ADR-003 | One agent with typed tools, no autonomous write permissions | Keep agent behavior understandable and safe | Accepted; implementation pending |
| ADR-004 | Deterministic time-feasibility engine outside LLM | Avoid mathematically impossible plans | Accepted; util prototype included |
| ADR-005 | Source-page citations from verified PDF chunks | Reduce hallucinations and improve trust | Accepted; implementation pending |
| ADR-006 | Desktop progressive 3D orb, static fallback | Memorable showcase without harming accessibility | Accepted; visual starter included |
| ADR-007 | Text-searchable PDF only for MVP | OCR/large file ingestion increases time and failure modes | Accepted |
| ADR-008 | Start P0 before P1 quizzes | Protect eight-day deadline | Accepted |

Add dated decisions here when the coding assistant changes architecture or requirements. Record concrete consequences and rejected alternatives.

## 2026-11-03 | Starter conversion
- Keep the OpenAI Agents SDK as the application's runtime orchestration for the MVP; `OPENAI_MODEL` is product-runtime configuration.
- Integrate the seven-screen HTML prototype as `design-reference/`, explicitly separate from the Next.js landing scaffold and real backend; future UI work should use route/component mapping, not iframe embedding.
- Keep P0 secure one-agent recovery workflow; quiz/analytics/complex 3D remain secondary.

## 2026-11-03: Orbital Atelier V2
- Adopt canonical `design-reference/CatchUp_AI_Orbital_Atelier.html` (nine screens, dark/light, original 3D perspective mockup), superseding the old seven-screen dark-only reference.
- Choose semantic light/dark tokens and persistent settings; production 3D interactive universe uses stable R3F v9/React 19, lazy-loaded and accessible with no-WebGL/reduced-motion fallback.
- The prototype 3D is standalone Canvas 2D perspective projection, not a production Three.js visualization.
- Keep all existing secure Next.js + Supabase + OpenAI Agents SDK infrastructure plans. No provider switch or fabricated agent execution.
- Target three honest deterministic scenarios, not one auto-generated timetable. P0 approved action remains transactionally idempotent.
- Aesthetic references are inspiration only; visual and code execution were authored specifically for CatchUp AI.

## 2026-11-03: Build session M0
- **ADR-009** Pin dependencies to verified current releases; TypeScript 6.0.x (not 7.0 native) until Next.js type-check support is confirmed; ESLint 9 kept for `eslint-config-next` 16 compatibility.
- **ADR-010** Local Supabase via Docker/CLI for development; cloud project only on user approval for deployment.
- **ADR-011** OpenAI runtime retained (doc 14). No key available yet: model and embedder are injectable so the agent loop and tools execute for real in tests with a scripted model; live runs are reported as unverified.
- **ADR-012** Appearance preferences (theme light/dark/system, motion, 3D) live in one `useSyncExternalStore` store mirrored to `<html data-*>` attributes, applied pre-paint by an inline script; later synced to the profile.

## 2026-11-03: Build session M1
- **ADR-013** Port the canonical reference CSS (`src/app/orbital.css`) rather than re-expressing it in Tailwind utilities: preserves design fidelity; Tailwind v4 remains for layout utilities with tokens exposed via `@theme inline`.
- **ADR-014** Production pages never render sample metrics. Missing data shows explicit "no data" states (`StatCard value={null}`, `ProgressArc percent={null}`) until real records exist.
- **ADR-015** 3D: one `OrbitalScene` (R3F v9) shared by dashboard and universe; props are a typed `UniverseGraph` built from the student's records. No drei (its `<Html>` broke under React 19.3); labels are an `aria-hidden` projected DOM overlay, and the DOM topic list is the accessible path. Continuous animation only on wide fine-pointer screens without reduced motion; otherwise `frameloop="demand"`.
- **ADR-016** Accessibility token adjustments over the reference palette (see BUILD_STATUS) to meet WCAG AA; enforced by axe in E2E.

## 2026-11-03: Build session M2
- **ADR-017** Passwordless auth: 6-digit email code (primary, works across devices) plus magic link via `/auth/confirm` (token_hash). No passwords, no demo bypass. Sign-out uses local scope.
- **ADR-018** Tenancy enforced in the schema: every child row carries `owner_id` and references its parent by composite `(id, owner_id)` FK; RLS is `owner_id = auth.uid()`; `authenticated` receives column-level INSERT/UPDATE grants only. `document.storage_path` is a generated column, and storage INSERT requires a matching pending document row.
- **ADR-019** Server-written tables (chunks, agent runs, proposals, plans, tasks, quizzes) are SELECT-only for students. Writes go through the `server-only` admin client after ownership checks, or SECURITY DEFINER RPCs that re-check `auth.uid()` (approval, rate limit). This supersedes the plan note about invoker RPCs for agent runs.
- **ADR-020** Rate limits are per-student fixed windows in Postgres (`consume_rate_limit`), so they hold across serverless instances.
- **ADR-021** Times are stored as UTC instants; entry/display use the profile's IANA zone via `@date-fns/tz` (DST-safe, unit tested).

## 2026-11-03: Build session M3
- **ADR-022** Upload = (1) API registers the document row (quota, validation), (2) browser uploads straight to the private bucket at the DB-generated path (storage policy requires a matching pending row), (3) API processes synchronously (≤50 pages, `maxDuration` 60s). No file bytes pass through Route Handler bodies.
- **ADR-023** Chunks never cross page boundaries, so each citation names exactly one page. ~2,400-char windows with 300-char overlap.
- **ADR-024** Hybrid retrieval with RRF; lexical OR-query works without any AI key, vectors are added when embeddings exist. A passage only counts as evidence above `EVIDENCE_THRESHOLD` (lexical rank ≥ 0.08 or cosine ≥ 0.30); otherwise the system abstains ("I couldn't verify that…"). Thresholds should be re-tuned once real OpenAI embeddings are available.
- **ADR-025** Evidence search returns verbatim passages only (no generated text); generated answers come from the agent (M5) and must cite these passages.
- **ADR-026** pdf.js via `unpdf` (serverless build), font loading disabled; extracted text is treated as untrusted data everywhere.

## 2026-11-03: Build session M4
- **ADR-027** Planner = pure deterministic engine (no AI, no clock reads). EDF over per-day local windows; with all work released now, EDF is optimal for deadlines, so a reported shortfall is real under the block rules.
- **ADR-028** Scenarios are nested item sets: essential (required + 1 recommended), balanced (+ all recommended), full (+ optional). Recommended items without AI are review sessions of indexed notes, pointed at the best-matching page found by retrieval for the related assignment.
- **ADR-029** Proposals are server-created from saved data only (what-ifs must be saved first), expire after 6 h, and only one is pending at a time. Approval is a SECURITY DEFINER RPC: row lock, idempotent result, DB-side staleness check (assignment/profile `updated_at` after proposal creation), infeasible refused, assignment deadlines re-checked; constraints enforce ownership and no overlap. Approving supersedes the previous active plan (unfinished tasks cancelled).
- **ADR-030** Overdue required work is never silently scheduled; it is surfaced with guidance.

## 2026-11-03: Build session M5
- **ADR-031** One `LearningRecoveryAgent` (Agents SDK `Runner`, custom tracing disabled). Tools receive a server-built `AgentContext` (verified user id, user-scoped client, admin client only inside the draft path); the model never supplies identity.
- **ADR-032** The timeline comes from events recorded inside our tool wrappers (status completed/denied/failed, duration, privacy-safe args), streamed via SSE and persisted in `agent_runs`; it cannot show a call that did not execute.
- **ADR-033** Answers use a structured output separating `facts` (each course-material fact must cite source ids retrieved in this run) from `suggestions`; facts citing unknown ids are removed and counted. Retrieved text is passed inside `<source>` tags labelled untrusted.
- **ADR-034** `draft_recovery_plan` delegates all numbers to the deterministic planner and creates a pending proposal; agent study items need retrieved evidence and rank ahead of generic review items. A failed run expires its draft.
- **ADR-035** Tests replace only the LLM with a `ScriptedModel` speaking the SDK protocol. Browser E2E can use it only when `CATCHUP_TEST_MODEL=scripted` AND Supabase is local; the UI labels it "Scripted test model · not AI". Never available in deployments.
- **ADR-036** E2E now runs against a production build on :3100, so every E2E run also verifies `next build`.

