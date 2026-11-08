# Yash Petkar: build tasks (8–13 Nov 2026)

Owner: Krishna Mathur. Reviewer for every change: Krishna. The challenge's final submission is on 14 Nov, so everything below must be merged by **13 Nov, 18:00 GST**.

## Ground rules (read first)
1. **Never push to `main`.** `main` deploys straight to production. Work on a branch (`yash/<feature>`), open a pull request, and wait for Krishna's review and a green CI run.
2. **One feature per pull request**, with tests. CI runs typecheck, lint, unit, integration, end-to-end, evaluation and the dependency audit; all must pass.
3. **Tests first.** Write the failing test, then the code. Every new database table gets row-level security, column grants and a two-student integration test (student A can't read or change student B's rows).
4. **Migrations start at `0022`** in `supabase/migrations/`. Never apply a migration to production yourself; Krishna does that.
5. **No secrets** in code, commits, screenshots or chat. Keys live in `.env.local` (git-ignored) and Vercel. Ask Krishna for a local `.env.local`.
6. **The AI only drafts.** Nothing the model produces is saved without the student's approval (see `src/lib/planner` and the approval transaction).
7. **No invented numbers.** If something wasn't run, write "not run". Add a dated row to `BUILD_STATUS.md` with the exact commands and results, and a decision entry in `docs/DECISIONS.md` (next is ADR-081).
8. **Free AI quota is about 20 requests a day per model.** Use the scripted test model for development (`npm test`, integration tests). Live-model runs only with Krishna's OK.
9. Commits use your own name and email, with no co-author trailers.

## Setup (once)
```bash
git clone https://github.com/krish2105/CatchupAI-Agentic-AI.git && cd CatchupAI-Agentic-AI
npm install
npm run db:start        # local Supabase in Docker (Colima or Docker Desktop)
npm run dev             # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run test:integration
```
Read first: `README.md`, `docs/02_ARCHITECTURE.md`, `docs/06_AGENT_RAG_SPEC.md`, `docs/DECISIONS.md`, the last 20 rows of `BUILD_STATUS.md`.

## Tasks, in priority order

### Y1. UAE study defaults in the planner (1 day, no AI quota)
**Why:** judges are Dubai-based; this shows the app is built for UAE students. Deterministic, so fully testable.
- Settings → "Local calendar" (all opt-in, default off except week start):
  - Week starts Monday (UAE schools and universities); Friday is a short day.
  - **Friday prayer:** no study blocks 12:00–14:00 local time on Fridays.
  - **Prayer-time blocks:** ~15 minutes around the five daily prayers, computed **on the device** with `adhan` (Umm al-Qura or Dubai method). No location is sent to the server; store only the chosen city/method.
  - **Ramadan mode:** daily study budget reduced by a chosen percentage, no heavy block in the hour before Maghrib, late-evening slots allowed. Dates from `Intl.DateTimeFormat('en-u-ca-islamic-umalqura')`, with a manual start/end override.
  - Show the Hijri date next to the Gregorian date on the schedule.
- Never assume a student's religion: every religious setting is a toggle, off by default.
- Tests: planner unit tests (Friday window excluded, Ramadan budget, DST-safe), one integration test for the saved preference, one E2E toggle test.

### Y2. Proactive check-in (1–2 days, almost no AI quota)
**Why:** the strongest "real agency" signal judges look for: the agent notices a problem on its own and proposes a fix, and a human approves only the exception.
- A daily job (extend `/api/cron/nudges`, protected by `CRON_SECRET`) finds students who are slipping: missed blocks, or a deadline that no longer fits the remaining time.
- For each, it creates a **pending** re-plan draft with the existing replanner (deterministic; no model call needed) and records why ("2 blocks missed; the worksheet no longer fits by 45 min").
- Dashboard card: "CatchUp noticed something" with the reason, the proposed change and **Approve / Dismiss**. Approval goes through the existing approval transaction (exactly once).
- Rate limit: at most one proactive draft per student per day. Opt-out in Settings.
- Tests: detection unit tests; integration (two students, only the slipping one gets a draft; approve commits once; dismiss leaves nothing); E2E for the card.

### Y3. "Built for UAE rules" trust panel (1 day)
**Why:** makes Responsible AI visible, which agentic rubrics reward.
- Age check at onboarding: the app is for students aged 13 and over (UAE Ministry of Education guidance on generative AI). Under 13 → polite stop, nothing stored.
- **Personal-data scrubber** before any prompt: mask emails, phone numbers and Emirates ID patterns (`784-XXXX-XXXXXXX-X`) in the student's message, with unit tests.
- **AI-use disclosure export** (Markdown/PDF) for academic integrity: which answers, plans and packs the AI drafted, their sources, and what the student approved. Students can attach it to coursework.
- A public section on `/quality` listing these controls, each linked to its code and test.

### Y4. Socratic tutor mode (1 day, uses AI quota sparingly)
**Why:** the 2025–26 trend (study modes that ask before they tell), but grounded in the student's own notes, with citations.
- A toggle in the copilot: "Guide me, don't tell me". Same agent and tools; the instructions change to ask one guiding question at a time and reveal the answer only after two attempts or on request.
- It still cites pages, and still says "I couldn't verify that" without evidence.
- Tests with the scripted model (the instruction switch, citations kept); one live run only with Krishna's OK.

### Stretch (only if Y1–Y4 are merged)
- **Explain my mistake** on quiz answers, cited to the page the right answer came from.
- **Audio recap:** a short spoken summary of a catch-up pack from its cited script (browser speech, one model call).

## Things only you can do (not code)
- Accept the GitHub invite (`Yashpetkar7`, write access).
- Use the live app on your own phone for 15 minutes and file every problem as a GitHub issue with a screenshot (synthetic data only, no real personal data).
- Ask two classmates to try the demo with `docs/VOLUNTEER_KIT.md`, collect their 👍/👎 and comments, and give Krishna their written consent. Krishna records the results; never invent feedback.
- Review Atharva's changes when asked.
