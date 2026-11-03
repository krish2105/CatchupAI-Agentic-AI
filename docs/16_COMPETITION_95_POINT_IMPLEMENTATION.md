# 16 | 95-point quality target: engineering strategy (not a promise of judging outcome)

This supplements the existing P0 product specification. The score is an **aspirational quality rubric**, not a probability of winning or a validated judge score. Never claim the event organizers assigned 95.

## Priority 0: real closed-loop academic recovery

- Safe Supabase Auth + PostgreSQL/RLS + course/assignment ownership checks.
- Authenticated private text-PDF upload, indexing, pgvector retrieval scoped to authorized course; no invented document/page citations.
- One LearningRecoveryAgent (OpenAI Agents SDK or separately approved runtime provider) with real typed tools: profile, assignments, document search, status, proposal draft. Tool traces must be real.
- Deterministic feasibility engine: deadline, availability, nonoverlap, time-zone handling, mandatory versus optional learning tasks.
- Three alternative scenarios: essential, balanced, full. Every scenario must show exactly how many minutes fit and whether more time is needed. **Reject infeasible plans** or require the user to change availability.
- Action proposal state: pending -> approved or rejected -> executed exactly once. User confirmation, secure transaction, idempotency, concurrency test.
- End-to-end test: sign in -> upload PDF -> cited answer -> compare recovery options -> approve -> reload persisted tasks -> complete task.

## Priority 1: credible innovation evidence

- Baseline and separate follow-up question sets that assess the same objectives, with answer keys validated against evidence.
- Topic-level mastery evidence and a replan recommendation based on missed concepts, not invented grade prediction.
- Explainable workload-risk indicator based on transparent inputs (not a clinical or predictive student profile).
- 30-case agent evaluation suite: 8 retrieval/citation cases, 8 schedule cases, 5 tool-selection cases, 5 approval cases, 4 security/adversarial cases.
- Small consenting usability pilot using synthetic student data, if time permits. Record honest findings; do not imply statistical validation.

## Priority 2: visual story and evidence

- Orbital Atelier full light/dark UI and immersive knowledge universe, with a no-WebGL fallback.
- Prepare a coherent 3-4 minute demo showing both an overload case and the approval gate.
- Publish only verifiable metrics and traces. Show a tested deployed URL, GitHub, README, architecture, and evaluated cases.
- Follow the private Nas.io checkpoint instructions and confirm the exact deadline/time zone; do not assume public summaries list every required form field.

## Time-box logic

1. Ship real P0 security and recovery features before the competition demo.
2. Add R3F universe and theme as a parallel visual track; never block the backend milestone for GPU polish.
3. Only add quizzes/replanning after core workflow tests pass.
4. Reserve deployment and evidence time; stop feature work when critical bug fixing is needed.

## Verification before declaring done

- All migrations apply to a fresh Supabase project. Every RLS policy has positive and negative tests.
- Actual `npm run typecheck`, `npm run lint`, `npm run build` and E2E commands run and documented with pass/fail.
- Real browser QA of dashboard/theme/mobile; 3D disabled, reduced motion and unsupported WebGL tested.
- No secrets in source or screenshots; no real student records in demo.
- Official checkpoint and final submission records retained in `submission/` once the organizer's forms are completed.
