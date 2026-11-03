# Demo script (3–4 minutes)

Record on the **deployed** app in a fresh browser profile, with synthetic data only. Show real behaviour; if something fails live, keep it in and show the recovery.

| Time | Screen | What to do | What to say |
| --- | --- | --- | --- |
| 0:00–0:20 | Landing | Show the alpine hero, click **Try the demo, no sign-up** | "Missing two classes snowballs: deadlines, unfamiliar topics, no idea what fits. Chatbots don't know your deadlines, your notes or your week." |
| 0:20–0:45 | Mission control | Point at the briefing: deadlines approaching, minutes short, outlook ring | "CatchUp AI starts from real data: two deadlines, 6h 30m of required work, and about 2h short before Saturday. That number is computed, not guessed." |
| 0:45–1:30 | AI copilot | Click **Missed class rescue** (or ask "I missed the regression lecture, what should I do?") | "The agent runs real, permission-checked tools — watch the timeline: my availability, my assignments, a search of my notes. Facts cite the page they came from; suggestions are labelled as advice." Click the citation chip to open p. 2. |
| 1:30–2:15 | Recovery lab | Compare **Deadline first / Balanced / Full recovery**; drag the weekly slider up | "Three honest routes from a deterministic planner. Infeasible routes show the exact shortfall and can't be approved. A what-if has to be saved before it can be approved." |
| 2:15–2:45 | Approval gate | **Review and approve** → read the exact-changes list → approve (double-click on purpose) | "Nothing is saved until I approve. The list shows exactly what changes. Double-clicking still creates one plan — approval is an idempotent database transaction." |
| 2:45–3:05 | Study schedule | Reload; show the week grid; tick one block | "The plan persists, in my time zone." |
| 3:05–3:30 | Practice arena | Take a 5-question check; open the source link of a wrong answer | "Questions come from my own notes with the source page. Missed concepts come back for revision tomorrow; retests target them." |
| 3:30–3:50 | Failure + recovery | Edit an assignment's estimate, then try to approve an older draft | "Inputs changed, so the system refuses the stale plan instead of saving something wrong — recompute and approve again." |
| 3:50–4:00 | Close | README architecture + eval report | "Next.js, Supabase with row-level security, an OpenAI Agents SDK agent with five tools, a deterministic planner, 160+ automated tests and a 30-case evaluation." |

Capture as stills: briefing, tool timeline with a citation, the three routes, the approval change list, the week schedule, a quiz result with its source.
