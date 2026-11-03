# Sprint 2 plan: 91 → 97+ in 1–2 weeks

Decisions (2026-11-04): deadline in 1–2 weeks · live AI on the **Gemini free tier** · build Catch-up Pack + Audio, Nudges + Feedback, Memory + MCP, Quality page + Forest · the agent records the demo video.

## Milestones (in order; each ends green on CI and deployed)

| # | Milestone | What students and judges see | Score | Days |
| --- | --- | --- | --- | --- |
| M1 | **Live AI on Gemini** | Copilot answers for real, with tool timeline, citations and drafts; run cost/latency shown in the trust drawer; eval T1–T5 measured | +4 | 1 |
| M2 | **Missed Lecture Catch-up Pack + Audio** | "I missed a lecture" → upload slides/notes/transcript → one-page cited summary, key terms, 5 check questions, a 30-min plan ("add to schedule" via approval); 🔊 Listen on the pack and on Mission Control | +3 | 2 |
| M3 | **Nudges + Feedback** | Opt-in morning email ("Today: 2 blocks, 1 deadline") and missed-block alert with one-click unsubscribe; 👍/👎 on plans and answers, feedback form | +2 | 1.5 |
| M4 | **Copilot memory + MCP** | "What the copilot remembers" panel (edit/delete); the copilot proposes memories, you confirm. Personal MCP token in Preferences → use CatchUp tools from ChatGPT/Claude desktop (read + draft only) | +2 | 2 |
| M5 | **Quality page + Growing forest** | Public /quality: tests, CI, eval, security findings, live health; trees grow on each course island as blocks are completed, plus a recovery-score timeline | +2 | 1.5 |
| M6 | **Recorded demo + volunteer kit** | Captioned 3-minute MP4 + subtitles recorded automatically from the live demo; volunteer test script and in-app feedback collection | +3 | 1 |
| — | Error monitoring (Sentry free) | Alerts on production errors | +1 | 0.5 (needs your account) |

## Technical notes (from research)
- **Gemini**: OpenAI-compatible base URL `https://generativelanguage.googleapis.com/v1beta/openai/`; the Agents SDK's `OpenAIProvider` accepts `baseURL` and `useResponses: false` (chat completions). Gemini allows only `parallel_tool_calls: false`, which the agent already uses. Structured output, tool-call round trips and Gemini 3 thought signatures must be verified by the eval before claiming success ([compatibility reference](https://googledevai-dot-devsite-v2-prod-3p.appspot.com/api/compatibility), [ai.google.dev](https://ai.google.dev/gemini-api/docs/openai?hl=fr), [DEV guide](https://dev.to/build996/google-gemini-api-the-best-free-ai-api-in-2026-complete-guide-2i4k)). Provider choice becomes `AI_PROVIDER=gemini|openai`; OpenAI remains supported.
- **MCP**: Vercel's `mcp-handler` 2.x serves the current MCP spec over Streamable HTTP at `/api/mcp`, with `withMcpAuth` for token verification ([repo](https://github.com/vercel/mcp-handler), [Vercel docs](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)). Tokens will be per-student, hashed like calendar feeds, revocable; tools are read-only or draft-only.
- **Audio**: browser Web Speech API (no cost, works offline, respects reduced-motion/user control).
- **Video**: Playwright `recordVideo` with viewport-matched size, on-page caption overlay timed to caption length, ffmpeg to MP4, plus .srt ([walkthrough pattern](https://flaviocopes.com/record-demo-video-playwright.md), [captions approach](https://blog.kestrelsnest.social/posts/2026-07-18-your-test-suite-is-a-video-studio/)).
- **Nudges**: Vercel cron + the configured Gmail SMTP (~500/day cap); opt-in only, signed unsubscribe link. Evidence: personalised reminders improved attendance in a 400-student study ([Pinisi](https://ojs.unm.ac.id/pjss/article/download/89197/37422)).

## Positioning for judges
NotebookLM-style tools summarise material; none plan a realistic recovery around a missed lecture. CatchUp's pitch: *“Missed a lecture? Get the cited catch-up pack, a plan that fits your real week, and nothing changes until you approve it.”* Judges in comparable agentic challenges weight technical implementation, task execution, real-world impact and the demo ([Devpost](https://agentic-ai-innovation-2026.devpost.com/rules), [IABH](https://iabhongkong.com/c25-agentic-ai-challenge-judging-criteria)); M1, M2 and M6 hit those directly.

## Needs from you
1. A free Gemini API key: create it at https://aistudio.google.com/apikey (no card). You type it into a hidden prompt; it never enters chat.
2. Optional: a free Sentry account for error alerts.
3. The competition's rules link when you have it, to tailor the video and README.
