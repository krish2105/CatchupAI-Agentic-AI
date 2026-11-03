# 09 — Live Demo, Explainer and Pitch Script

Target: **2–4 minutes**, using a working deployed project and fictional student records. Do not fake AI behavior; if a feature isn't complete, disclose it and cut it from the demo.

## Storyboard

**0:00–0:20 — Hook / problem**
"When students miss just two classes, deadlines and unfamiliar topics pile up. A generic chatbot doesn't know their actual course material or time constraints."

**0:20–0:40 — Product**
Show CatchUp AI dashboard and optional lightweight 3D knowledge orb: "CatchUp AI connects course knowledge, assignments and available time into an evidence-grounded recovery workflow."

**0:40–1:20 — Evidence and agent behavior**
Open a fictional student course, show uploaded PDF and assignment. Type: "I missed the regression lecture and have an assignment due Friday. What should I do?" Display *real* tool timeline (`list_assignments`, `search_course_material`, `get_study_preferences`) and a correct source page citation. If the agent has insufficient data, let the real error/clarification show.

**1:20–2:00 — Feasibility / proposal**
Show calculated required/available hours and a plan. Explain what doesn't fit and why the agent prioritized tasks. Show approval as a separate, explicit action.

**2:00–2:30 — Persistence / proof**
Approve, reload, show saved tasks; demonstrate rejected or duplicate approval behavior if practical. For P1, complete a quick quiz and review a plan adjustment.

**2:30–3:00 — Implementation, impact and next steps**
Overlay diagram: Next.js -> authenticated backend -> OpenAI agent tools -> Supabase/RAG -> deterministic planner -> user approval. Mention real limits (text PDFs only, no LMS connection) and deployment. Show GitHub/README and live link.

## Capture assets
- 1 clean hero/dashboard screenshot
- 1 real agent tool timeline with citeable content
- 1 cited PDF explanation
- 1 feasibility/proposal view
- 1 approved task list with persisted status
- 1 brief architecture diagram and selected tests

## LinkedIn post blueprint (user writes/approves final copy)
- What I built and why this problem matters
- What makes it *agentic* (actual tools and decisions)
- One concrete end-to-end workflow with evidence
- Stack and architecture, concise
- Live demo, repository and optional video links
- Acknowledgement of organizer/challenge and relevant required tags when provided

## Pitch deck outline, 6 slides
1. User pain / missed-class recovery
2. CatchUp AI solution and differentiation
3. Real tool-calling user journey
4. Backend/RAG/security architecture
5. Demo screenshots and validated tests
6. Impact, limitations, future enhancements

Use only screenshots and measured metrics from the actual completed app.
