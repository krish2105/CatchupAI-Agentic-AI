# 01 — Product Requirements Document

## Product
**CatchUp AI — Autonomous Learning Recovery Agent.** A stand-alone AI-assisted web application that helps students recover from missed coursework with realistic, explainable plans. This is a hackathon MVP, not an institutional LMS replacement.

## User and problem
Primary user: a student with two or more courses, missed lectures, inconsistent study availability, and upcoming assignment deadlines. They know they are behind but cannot decide what to study first. A chat-only tutor offers generalized advice but does not know actual deadlines, learning sources or available time.

**Outcome:** from 'I'm behind' to an evidence-grounded, feasible, user-approved study plan and measurable progress.

## Differentiating insight
**Recovery feasibility**: calculate whether the required hours fit before deadlines, clearly flag overload, present tradeoffs and alternative priorities. This is validated in deterministic backend code, not guessed from model prose. Add a *real execution timeline* showing the data sources/tools that produced the proposal.

## Primary end-to-end journey (P0)
1. Register/login securely. Set preferred time zone, study minutes per day and general weekly availability.
2. Create a course; upload a text PDF; see ingestion state and searchable pages; add an assignment and deadline.
3. Ask 'I missed module four and my task is due Friday; what can I do?'.
4. Agent retrieves course notes and assignment deadlines, checks availability, proposes a prioritized recovery plan and explains feasibility, with document/page citations.
5. Student sees task durations, schedule/conflicts and approval controls; either approves or rejects.
6. Approved tasks persist; mark tasks done, refresh and see actual progress.

## Screens
- Public product overview and demo explanation (3D knowledge-orb allowed here)
- Auth/sign-in and onboarding
- Dashboard with factual progress + recovery-feasibility card
- Courses and document knowledge hub (PDF upload/status)
- Assignment editor/list
- AI study agent (chat, cited sources, actual tool activity)
- Plan review (approve/reject; optional alternative schedule)
- My tasks/progress
- Quiz + results (P1)

## P0 acceptance criteria
- A new user can complete the entire journey in one hosted deployment.
- Cross-account access is denied by RLS and route ownership checks, including vector retrieval and storage objects.
- A PDF with searchable text yields at least one relevant, accurately attributed source reference; unsupported text yields 'I couldn't verify that in your uploaded materials'.
- A plan with insufficient capacity is shown as infeasible and lists a rational priority alternative.
- Reject produces no tasks; repeated approve never duplicates tasks.
- All AI responses clearly separate retrieved course facts from suggestions.
- 3D is a progressive enhancement, not a functional dependency; a screen-reader and reduced-motion user can use all flows.
- No fake demos, simulated external services, hard-coded secret keys or unsupported winner claims.

## P1
- Five-question grounded quiz, answers/scoring, weak-topic tracking and a proposed plan revision.
- Actual completion dashboard and optional weekly summary.

## Non-goals for eight days
- Full LMS, institutional SSO, faculty/admin portal, gradebook, video conferencing, mobile store apps, deeply personalized adaptive ML training, autonomous external writes, voice assistant, a heavy 3D virtual world.

## Metrics (all drawn from actual records)
- Time to first valid plan after uploaded text is processed.
- Success of RAG source attribution on a fixed set of expected answers.
- Plan feasibility validation pass rate.
- Duplicate approvals and unauthorized access attempts (target zero successful).
- Task completion and quiz improvement (illustrative, not clinical/educational outcome claims).

## Demo dataset
Use synthetic student data from `data/demo_scenario.json`. No institution-owned or real student material without written permission.

## Orbital Atelier V2 visual requirement addendum
The final product experience must implement the nine routes and full light/dark/system themes in `docs/15_ORBITAL_ATELIER_VISUAL_REDESIGN.md`, with a functioning accessible React Three Fiber Learning Universe and interactive three-scenario recovery lab. The standalone HTML is purely simulated and must never substitute for backend P0 completion. Theme/motion preferences, meaningful data-driven 3D nodes, no-WebGL fallback and approved plan persistence are the acceptance criteria.
