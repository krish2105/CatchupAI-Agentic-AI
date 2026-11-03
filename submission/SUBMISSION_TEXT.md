# Copy-ready text for the portal and forms

All facts verified on 2026-11-04. The official field names for Days 1–8 appear only when each day unlocks, so match these to the
actual fields and trim to any length limit shown. Nothing here has been submitted.

## Project name
CatchUp AI: agentic study recovery for students who fall behind

## One-liner (≈ 20 words)
An AI agent that reads your own lecture notes, checks whether your deadlines really fit your week, and drafts a recovery plan you approve.

## Short description (≈ 60 words)
Missing one lecture can snowball. CatchUp AI turns a student's own notes into a cited catch-up pack, answers questions from those
pages, and uses an agent with seven permission-checked tools to draft a recovery plan. A deterministic planner shows whether the plan
fits before each deadline, and nothing is saved until the student approves it.

## Long description (≈ 200 words)
Students who miss a lecture rarely know what they missed, how much time they really have, or whether a plan is realistic. Generic
chatbots answer without any link to what the lecturer taught.

CatchUp AI starts from the student's own material. A catch-up pack summarises the missed lecture with key terms and check questions,
each linked to its page. The copilot is a single agent (OpenAI Agents SDK, Google Gemini) that decides which of seven tools to use:
deadlines, free time, the student's notes, progress, saved preferences, and a plan draft. Every fact it states must cite a page that
actually supports it; text that tries to instruct the AI is flagged and ignored.

Time is never guessed. A deterministic planner schedules the work into the student's real free time and shows three routes, with any
shortfall in minutes. The AI can only draft: the student reviews the exact changes and approves once, in a locked transaction.

It's live with a one-click demo on synthetic data, backed by 267 automated tests, a 38-case agent evaluation (30 passed, 0 failed,
8 waiting on the live model), a RAG evaluation with page-level ground truth and a security review.

## What makes it agentic (≈ 80 words)
The model plans its own steps: it chooses which tools to call, in what order and with what arguments, what to search for, and which
study items to propose. Every call is a real, logged tool execution against the student's own data. The boundaries are deliberate: tools
can read or draft but never save, approve or delete, so the student stays in control of anything that changes their week.

## Tech stack
Next.js 16, React 19, TypeScript · Supabase (PostgreSQL with row-level security, pgvector, private storage) · OpenAI Agents SDK with
Google Gemini Flash and gemini-embedding · Vercel (Seoul) · Vitest, Playwright, GitHub Actions · SwiftUI iPhone shell.

## Day 0 intro message (WhatsApp)
Hi everyone, I'm Krishna. I'm building CatchUp AI: an agentic copilot that helps students recover after missing a lecture. It reads
your own notes, cites the pages, checks whether your deadlines fit your week, and only changes your plan when you approve it. Looking
forward to learning with you all.

## "Submit for Demo" (already have an app)
CatchUp AI is live at https://catchupai-chi.vercel.app (click "Try the demo, no sign-up"; synthetic data). Code:
https://github.com/krish2105/CatchupAI-Agentic-AI. A single agent with seven permission-checked tools drafts recovery plans from a
student's own notes and deadlines; a deterministic planner checks feasibility and the student approves every change.

## Links
See [SUBMISSION_LINKS.md](SUBMISSION_LINKS.md).
