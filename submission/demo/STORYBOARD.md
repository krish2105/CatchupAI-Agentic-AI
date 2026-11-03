# Demo video: 3–4 minute storyboard and recording checklist

**Rule:** the copilot segment must show the **live model** (the model chip reads e.g. "gemini-2.5-flash", not "Scripted test
model"). The existing automatic cut (`npm run demo:record`, 2:13) uses the scripted test model and says so in its captions.
Use it only as a fallback, labelled.

| Time | Shot | Voice-over | Proof on screen |
| --- | --- | --- | --- |
| 0:00–0:20 | Landing | "Priya missed her regression lecture. Her worksheet is due Friday. CatchUp AI helps her recover, with evidence and her approval." | Live URL in the address bar |
| 0:20–0:40 | Try the demo → Mission control | "One click, synthetic data, nothing to sign up for." | Demo banner, briefing |
| 0:40–1:05 | Catch-up pack | "Her own notes become a summary, key terms and check questions, each linked to its page." | Page chips, open p. 2 |
| 1:05–1:50 | Copilot: "I missed the regression lecture…" | "The agent decides what to look up: her deadlines, her free time, the lecture notes. Each step is a real tool call." | **Live tool timeline**, model chip, page citations, facts vs suggestions |
| 1:50–2:20 | Recovery lab | "A fixed algorithm, not AI, checks whether the work fits. This route doesn't fit by 90 minutes, so it can't be approved." | Three routes, shortfall |
| 2:20–2:45 | Approval dialog → schedule | "She sees every block before saving. Approval saves exactly once." | Exact changes, schedule after reload |
| 2:45–3:05 | "Why trust this?" | "Decision history, pages used, tools that ran, model, time and tokens, and what it can't know." | Trust drawer |
| 3:05–3:25 | Malicious PDF (optional cut) | "This document tries to tell the AI to approve her plan. It's flagged and ignored." | Timeline: "flagged as possible prompt injection" |
| 3:25–3:50 | /quality + close | "Every number here is generated: tests, evaluations, CI and live health." | Quality page |

**Checklist:** live model configured and verified · fresh browser profile · synthetic data only · no keys, emails or terminal on
screen · 1920×1080 or 1280×720 · captions (SRT) · 3–4 minutes · end on the URL · upload unlisted (YouTube or Loom) and paste the link
into the Day 8 form.
