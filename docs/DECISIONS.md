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
