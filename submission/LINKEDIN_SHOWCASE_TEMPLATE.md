# LinkedIn showcase — draft (edit before posting; replace every [placeholder])

Missing two classes shouldn't mean losing the semester.

For the Decoding Data Science Agentic AI Challenge I built **CatchUp AI**, an agentic recovery planner for students who've fallen behind.

What makes it agentic (and honest):
• It reads your real deadlines, weekly availability and uploaded course PDFs through permission-checked tools — and shows every tool call it actually ran.
• Answers cite the exact page in your notes, or say "I couldn't verify that".
• A deterministic planner compares three recovery routes and states the shortfall in minutes when a week doesn't fit.
• The AI only drafts. Nothing is saved until you approve, and approval is an idempotent database transaction.
• Built-in practice: knowledge checks from your own notes, spaced revision of what you missed, and a focus timer.

Stack: Next.js, Supabase (Postgres + row-level security + pgvector), OpenAI Agents SDK, React Three Fiber.
Quality: [N] automated tests and a 30-case evaluation ([X] passed) — results in the repo.

Try it (one-click demo, synthetic data): [live URL]
Code: https://github.com/krish2105/CatchupAI-Agentic-AI
Demo video: [video URL]

#AgenticAI #EdTech #NextJS #Supabase [organizer tags from the challenge page]
