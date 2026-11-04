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

## 2026-11-03: Build session M6
- **ADR-037** Knowledge checks use a deterministic cloze generator over the student's own indexed sentences (key concept = recurring course term; distractors = other course terms; seeded shuffle). Grounded, testable and available without an AI key. LLM-generated questions are a later option once a key is configured.
- **ADR-038** Answer keys live in `quiz_keys` (RLS on, no student grants); the browser only ever receives prompts/options/evidence. Grading and attempt writes happen server-side.
- **ADR-039** Insights only aggregate persisted rows (completed task timestamps set by DB trigger, graded attempts). Chart colours validated with the dataviz checker; single series → no legend; hover tooltip and a table view for accessibility.

## 2026-11-03: Build session M7
- **ADR-040** Baseline security headers (nosniff, frame DENY, referrer policy, permissions policy, COOP) and `Cache-Control: private, no-store` on all API routes. A CSP is deferred because of the inline pre-paint theme script (would need a nonce); tracked as a known limitation.

## 2026-11-03: Nature Flow 3.0 — R1/R2
- **ADR-041** Redesign as a token layer (`src/app/nature.css`) on top of the existing component CSS: verified layouts, tests and logic are preserved; themes are "alpine morning" (light) and "moonlit forest" (dark).
- **ADR-042** Landscape art is an inline, theme-aware SVG (no network cost, works offline and in both themes); generated panoramas can replace it later behind the same `.landscape` slot.
- **ADR-043** Mission Control briefing, plan card and route summary are computed from the planner and persisted plan/runs; the hero headline changes only when the balanced route is genuinely over capacity.
- **ADR-044** Missed Class Rescue = a preset copilot request scoped to the course with the nearest required deadline, auto-run once (guarded against Strict Mode double effects and reloads). Unavailable without an AI runtime (honest notice).
- **ADR-045** ⌘K command palette: native `<dialog>` + combobox/listbox semantics; only real destinations and actions are listed.

## 2026-11-03: Practice, demo access, evaluation
- **ADR-046** Spaced revision is a deterministic Leitner schedule over server-graded answers (miss → 1 day; correct → 3, 7, 14). Concepts never missed are not scheduled. Adaptive retests blank exactly the missed concepts.
- **ADR-047** One-click demo = Supabase anonymous sign-in + server seed through the visitor's own RLS client (admin only inside ingestion). Protected by Turnstile when configured (Supabase verifies the token for all sign-in methods), deleted after 24 h by a CRON_SECRET-protected job.
- **ADR-048** Evaluation runs the real system (local Supabase + deterministic engine). Cases needing an LLM are reported as skipped, never simulated. Retrieval evidence now includes query-term coverage after the eval exposed rank-only false abstentions.

## 2026-11-04: Replanning and Teach-It-Back
- **ADR-049** Replans subtract completed study-block minutes per assignment (from any plan, including superseded ones) so approved replans never reschedule finished work; missed blocks are surfaced, never auto-moved.
- **ADR-050** Teach-It-Back is deterministic: key concepts are recurring terms in the body sentences of evidence-filtered passages; feedback names covered/missing concepts with page citations and abstains without evidence. Attempts are server-written (students can read/delete only) so coverage can't be forged. An LLM may later phrase feedback but never decides coverage.
- **ADR-051** Rubric Decoder is deterministic and read-only until the student saves: sentences of an indexed brief are classified (weighted criterion > dated deadline > deliverable > requirement) with their page. Checklist rows are student-owned (RLS + composite keys to their own assignment and document); only `done` and `text` are updatable, so weights and kinds keep their source meaning.
- **ADR-052** Security baseline: nonce-based CSP from `src/proxy.ts` (all pages render per request), Origin check on writes on top of SameSite=Lax, HSTS. Demo accounts get separate, smaller budgets for costly operations; `consume_rate_limit` accepts only allowlisted buckets with fixed windows. CI runs unit + build + prod audit + bundle key scan, then integration/E2E/eval on a local Supabase.

## 2026-11-04: Feature batch
- **ADR-053** Calendar feeds use a 256-bit random token in the URL (calendar apps can't sign in); only its SHA-256 is stored, the link is shown once, revocation is immediate, and the feed query always filters by the resolved owner.
- **ADR-054** Trust drawer reads only server records (proposal, run events, citations) and states limits explicitly; it never summarises with AI.
- **ADR-055** Weekly next steps and the learning-trail study order are deterministic; prerequisites exist only when the student adds them (no inferred links), and loops are refused server-side.

## 2026-11-04: Batch A (path to 100)
- **ADR-056** Model fallback chain: one retry on a second model (`GEMINI_FALLBACK_MODEL`, which has its own free daily quota; ignored if it equals the primary) only for failures a second model can fix: daily quota, rate limit, 5xx overload, provider timeout, or the primary attempt's 100 s budget. Never for bad output, loops, cancellation or the overall 170 s timeout. The fallback restarts the conversation (no cross-model thought signatures). The first attempt's tool calls stay in the trace with `attempt` markers because they really ran; its draft is expired first so at most one draft per run is actionable; per-request search budgets count per attempt, the memory-suggestion budget per run. `agent_runs.model` names the model that produced the outcome; `fallback_from`/`fallback_reason` (migration 0016, check-constrained, server-written) say what was skipped and why. Limitation: token usage of a failed first attempt isn't recorded (the SDK throws before returning usage).
- **ADR-057** Streamed answers without showing unchecked claims: the answer is structured JSON, so the server parses it incrementally (`partial-answer.ts`, a stack scanner that only closes containers at valid cut points) and emits `answer` events. A fact is emitted only when its object is complete and it passes `verifyAnswer` on its own, so the claim check runs before display, not after. Suggestions (advice) stream every ~12 characters or when a suggestion finishes. Each model turn resets the live view; a fallback sends a reset too. The persisted, fully verified answer in `final` always replaces the live view, so streaming can't change what is stored. Gemini's streamed tool calls arrive in pieces, so `geminiFetch` reassembles them from the SSE bytes (passed through untouched) to keep Gemini 3 thought signatures working. `AGENT_STREAMING=off` is the switch if a provider's stream misbehaves.
- **ADR-058** Tool-result cache: in-process, per student, 60 s, 500 entries, for the three read tools only. Invalidation hooks the one place every authenticated write passes: `route()` opens an AsyncLocalStorage scope with the HTTP method and `requireApiUser()` clears the student's entries on any non-GET, again in `finally` (covers failed and partial writes). A per-student generation in the key drops reads that raced a write. The ownership check (`assertCourse`) is never cached. Chosen over a shared cache (Redis/DB) because it adds no service or cost; the price is up to 60 s staleness across server instances, accepted because the copilot only drafts and the planner re-reads everything when a draft is created and approved.
- **ADR-059** Plan self-check is a separate, pure re-check of the stored draft, not a flag from the planner: it trusts only the blocks and recomputes overlaps, block lengths, per-item deadlines (study items too, which the database's assignment-deadline guard doesn't cover), minute totals and required coverage. It is computed on every read (never stored, so it can't drift from the payload) and the payload itself never goes to the browser in run listings, only the result. "fail" blocks approval in the service before the RPC; "shortfall" is allowed to exist but approval is still refused by the existing infeasible rule, and the badge says exactly what doesn't fit and why.
- **ADR-060** Recovery score and clock skew: database timestamps (`completed_at`, set by trigger) and the rendering server's clock are different clocks. "Due by now" uses the server's `now`; "completed by" uses the end of the local day, so a completion stamped a few ms ahead is never lost.
- **ADR-061** Trace viewer `/runs/[id]` is a server component that reads `agent_runs` only through the signed-in student's client, so RLS is the access check (no separate owner logic to get wrong); a missing or foreign run is indistinguishable (not-found, no data). It shows only what was recorded during the run (ADR-032): tool order, stored argument summaries, outcomes and timings, run-level tokens and cited pages, plus an explicit "what this can't show" list (no model reasoning, no per-step tokens, shortened arguments). Known limit: once the app layout has streamed, Next.js serves the not-found UI with HTTP 200.

