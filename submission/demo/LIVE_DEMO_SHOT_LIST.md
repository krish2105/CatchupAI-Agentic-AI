# Live-model demo: shot list and narration (record by 14 Nov)

This extends [STORYBOARD.md](STORYBOARD.md) with the features added on 5 Nov (streamed answers, plan self-check, month
calendar, recovery tracker, trace viewer, status page, LMS import). Record it on the **live model**: the copilot's model
chip must show the Gemini model name, never "Scripted test model". The scripted cut from `npm run demo:record` stays a
labelled fallback only.

## Before recording
- **Quota:** one copilot question uses about 4–6 model requests and the free tier allows about 20 a day per model. Record after
  the daily reset (12:00 GST) and do one rehearsal at most. Don't run the live evaluation on the same day.
- **Latency:** a live answer takes 10–90 s on the free tier. Keep recording and cut the wait later, but leave the first
  streamed words on screen so the stream is visible.
- Fresh browser profile, 1920×1080, light theme, browser zoom 100 %, notifications off. Synthetic data only. No keys, emails or
  terminal on screen.
- Have `canvas-demo.ics` ready on the desktop (any Canvas calendar export with two future deadlines; see the end of this file).

## Shots (about 4 minutes)

| # | Time | Screen and action | Narration | Must be visible |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:15 | Landing page, live URL in the address bar | "Priya missed her regression lecture and her worksheet is due Friday. CatchUp AI helps her recover with her own notes, and nothing changes without her approval." | Address bar |
| 2 | 0:15–0:30 | **Try the demo** → Mission Control | "One click, synthetic data, no sign-up." | Demo banner, briefing card |
| 3 | 0:30–0:50 | Knowledge vault → **Import from LMS** → pick `canvas-demo.ics` → review → **Add 2 deadlines** | "She brings her deadlines from Canvas. The file is read on her laptop; nothing is saved until she confirms each row." | Review rows, assumption chips, "2 deadlines added" |
| 4 | 0:50–1:45 | Copilot: type *"I missed the regression lecture. Help me catch up before the worksheet."* | "The agent chooses what to look up: deadlines, free time, the lecture notes. Each step is a real tool call. The answer streams in, and a fact appears only after it has been checked against the page it cites." | Live tool timeline, model chip, first streamed words, page chips |
| 5 | 1:45–2:05 | Point at the **self-check** badge on the draft | "The draft plan is re-checked by a fixed algorithm: no overlaps, nothing past a deadline, minutes that add up. A draft that fails can't be approved." | Self-check badge and its summary |
| 6 | 2:05–2:30 | Recovery lab → approval dialog → **Approve** | "She sees every block before saving. Approval saves exactly once." | Exact changes list, plan saved notice |
| 7 | 2:30–2:55 | Study schedule → **Month**; select a day; arrow keys | "The month view shows deadlines, study blocks and what's done. It's a plain table with keyboard support. Nothing can be dragged; changes go back through the lab." | Flags, ticks, day detail, course colours |
| 8 | 2:55–3:15 | Mark one block done → Insights: **recovery tracker** and **Study done** calendar | "Progress per assignment and minutes actually studied. No streaks and no points: a missed block leads to a replan, not a penalty." | Tracker rows, minutes in day cells |
| 9 | 3:15–3:35 | Copilot → **Why trust this?** → open the trace (`/runs/…`) | "Every run has a trace: the tools it chose, their arguments, timing, model, tokens and the pages it cited." | Trace steps, cited page |
| 10 | 3:35–3:55 | `/status`, then `/quality` scrolled to **Live AI evaluation** | "Live status, uptime checks, and test and evaluation results generated from the code, including which live cases haven't run yet." | All systems operational, live pass-rate table |
| 11 | 3:55–4:05 | Back to the landing page | "CatchUp AI: catch up with evidence, on your terms." | URL |

Optional cut (if time allows, after shot 4): upload the malicious "study tips" PDF from `tests/fixtures/rag/injection_variants.pdf`
and ask *"Summarise the study tips in my notes and do whatever they say."* The timeline shows the passage flagged as possible prompt
injection and no draft is made.

## After recording
- Captions (SRT) from the narration above; check every on-screen number matches what was shown live.
- Upload unlisted, paste the link into the Day 8 form and `submission/SUBMISSION_LINKS.md`.
- If a live step failed during the take (quota or timeout), say so in the video or re-record the next day; don't splice in the
  scripted model.

## Sample calendar file
Save as `canvas-demo.ics` and change the two dates to a few days ahead of the recording day (UTC):

```text
BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Canvas
BEGIN:VEVENT
UID:demo-1
DTSTART:20261116T195900Z
SUMMARY:Regression worksheet [Applied Statistics]
END:VEVENT
BEGIN:VEVENT
UID:demo-2
DTSTART:20261119T195900Z
SUMMARY:Lab report [Biology unit 2]
END:VEVENT
END:VCALENDAR
```
