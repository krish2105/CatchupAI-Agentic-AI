# NEW: Orbital Atelier V2 (dark + light + interactive 3D)

The canonical **nine-screen standalone HTML demo** is `design-reference/CatchUp_AI_Orbital_Atelier.html`. Open it directly in a browser with no install, or after `npm run dev` open `http://localhost:3000/orbital-atelier-preview.html` (identical copy under `public/`). Includes both themes, math-projected interactive 3D knowledge map, AI workflow simulation, scenario comparison, approval, local schedule, quiz and insights. This is not the live application/backend.



# CatchUp AI | Agentic Learning Recovery

A engineering starter for a competitive eight-day AI app challenge. **The archive is not a finished product.** It includes a Next.js/React Three Fiber visual scaffold, a separate interactive HTML UX simulation, synthetic demonstration data, draft PostgreSQL migration, implementation architecture, safety rules and a short kickoff prompt.

1. Read `START_HERE.md`.

## Preview before coding
- **UX interaction simulation:** `design-reference/CatchUp_AI_Interactive_Prototype.html` (open directly in browser; simulated data/actions).
- **Actual scaffold:** `npm install && npm run dev`, then `http://localhost:3000` (requires npm access, not verified here).
- **Screenshots:** `design-reference/Desktop_Preview.png` and `Mobile_Preview.png`.

## Architecture

## Specs and progress
- `docs/01_PRD.md` to `docs/14_RUNTIME_MODEL_POLICY.md`: product, architecture, UI, API, RAG, database, testing, submission and operational details.
- `BUILD_STATUS.md`: honest implementation tracker.
- `submission/`: preparation templates (not submitted to organizer).

## Real P0 success
An authenticated student uploads a real text-based PDF and assignments, receives a source-cited response from a real authorized agent tool, sees a feasible schedule proposal, approves or rejects, and sees a persistent saved plan after refresh. Cross-student access is blocked, and all components are testable and usable without WebGL.

## Challenge
Official event: https://nas.com/artificialintelligence/challenges/building-agentic-ai-application-nov . Public rules do not disclose every Day 8 form field or verify the time zone. See `docs/08_SUBMISSION_REQUIREMENTS.md` for confirmed versus recommended deliverables.
