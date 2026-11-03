# 11 | Nine-screen Orbital Atelier UX-to-production map

## Canonical design and visual QA

- Open **`design-reference/CatchUp_AI_Orbital_Atelier.html`**, not the former seven-screen reference. Navigate all nine sections and test complete light/dark theme toggle (header + preferences).
- QA screenshots: `design-reference/Orbital_Dark_Desktop.png`, `Orbital_Light_Desktop.png`, `Orbital_3D_Atlas.png`, `Orbital_Recovery_Lab.png`, `Orbital_Mobile_Dark.png`, `Orbital_Mobile_Light.png`.
- The demo has a perspective-correct Canvas **2D** projected constellation, not WebGL. Production must use React Three Fiber v9 and actual authorized data.

## Routes

| Mockup view | Real route | Main backend dependencies | Priority |
| --- | --- | --- | --- |
| Mission control | `/dashboard` | verified assignments, available hours, approved tasks | P0 |
| Learning universe | `/universe` | permission-scoped course/topic graph, current progress | P1 visual, accessible route |
| AI copilot | `/assistant` | authenticated agent tools, cited evidence and real traces | P0 |
| Recovery lab | `/recovery` | deterministic three-scenario feasibility engine, proposal records | P0 |
| Knowledge vault | `/courses` `/courses/[id]` | private upload, extraction, embeddings, retrieval, source pages | P0 |
| Study schedule | `/planner` | approved plan, persisted tasks/completion/time zone | P0 |
| Practice arena | `/quizzes` | source-backed quiz and assessment attempt persistence | P1 |
| Your momentum | `/insights` | derived completion and assessment reports | P1 |
| Preferences | `/settings` | dark/light/system, motion, 3D, auth/profile settings | P0 |

Also implement `/login`, route-level loading, errors, empty states and 404. Onboarding should not require access to 3D.

## Key cross-screen flow

Student login -> course + assignment + private text PDF -> AI asks authorized tools and cites course page -> lab compares three realistic plans -> approve preview/transaction -> reload persisted schedule -> complete a task -> run small quiz -> insights update from real graded result.

## UX and implementation rules

- Responsive desktop sidebar and mobile drawer, touch/keyboard support. Both themes must be complete and legible, including modals, charts, quiz answers, focus and canvas.
- Topic selection from WebGL must have equivalent accessible DOM controls; keep DOM primary for all forms and approval actions.
- The standalone demo's AI tool timeline, document names, dashboard metrics, course states, quiz and approval actions are **simulations**. Port UX only, never fake backend results.
- Real RAG answer source links must resolve to permission-checked document/page metadata. Real agent timeline from execution logs.
- Recovery lab cannot approve an infeasible plan; no silent direct AI writes. Idempotent backend approval, tested for concurrency, cancellation and rejection.
- A student can complete main P0 loop with reduced motion on, 3D off and screen zoomed to 200%.
