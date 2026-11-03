/** Weekly review: deterministic next steps from the student's own week (no AI). */
export type WeekStats = {
  blocksCompleted: number;
  blocksMissed: number;
  blocksUpcoming: number;
  focusMinutes: number;
  dueRevision: number;
  weakExplanations: { topic: string; coverage: number }[];
  deadlinesNext7: number;
  hasActivePlan: boolean;
};

export type Recommendation = { title: string; reason: string; href: string };

/** Up to three next steps, most urgent first. Every reason quotes the number it comes from. */
export function weeklyRecommendations(s: WeekStats): Recommendation[] {
  const out: Recommendation[] = [];
  if (s.blocksMissed > 0) out.push({ title: `Replan around ${s.blocksMissed} missed block${s.blocksMissed === 1 ? "" : "s"}`, reason: "Missed time is rescheduled from now; completed work is kept.", href: "/recovery?replan=1" });
  if (!s.hasActivePlan && s.deadlinesNext7 > 0) out.push({ title: "Approve a recovery route", reason: `${s.deadlinesNext7} deadline${s.deadlinesNext7 === 1 ? "" : "s"} in the next 7 days and no active plan.`, href: "/recovery" });
  if (s.dueRevision > 0) out.push({ title: `Retest ${s.dueRevision} concept${s.dueRevision === 1 ? "" : "s"} due for revision`, reason: "Spaced revision brings back what you missed at the right time.", href: "/quizzes" });
  const weakest = [...s.weakExplanations].sort((a, b) => a.coverage - b.coverage)[0];
  if (weakest) out.push({ title: `Explain “${weakest.topic}” again`, reason: `Your last explanation covered ${weakest.coverage}% of its key concepts.`, href: "/quizzes" });
  if (s.hasActivePlan && s.focusMinutes < 50) out.push({ title: "Book one 25-minute focus sprint", reason: `${s.focusMinutes} focused minutes logged this week.`, href: "/focus" });
  if (!out.length && s.blocksUpcoming > 0) out.push({ title: "Keep the rhythm", reason: `${s.blocksUpcoming} block${s.blocksUpcoming === 1 ? "" : "s"} still to come this week.`, href: "/planner" });
  if (!out.length) out.push({ title: "Plan next week", reason: "Add upcoming deadlines so your routes stay realistic.", href: "/courses" });
  return out.slice(0, 3);
}

/** Monday (YYYY-MM-DD) of the week containing `now` in the student's time zone. */
export function weekStart(now: number, timezone: string): string {
  const local = new Date(new Date(now).toLocaleString("en-US", { timeZone: timezone }));
  local.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
