/**
 * Proactive check-in: is a student slipping? Pure and deterministic (no AI, no clock reads).
 * A student is slipping when blocks of their approved plan passed unfinished, or when required work due in the
 * next two weeks is no longer covered by what is done plus what is still scheduled before its deadline
 * (the recovery tracker's "short by" minutes). The reason is one plain sentence shown on the dashboard card.
 */
import { assignmentTracker } from "@/lib/insights/tracker";
import type { ScenarioKey } from "@/lib/planner/engine";
import { missedBlocks } from "@/lib/planner/progress";

export type CheckinBlock = { assignmentId: string | null; startsAt: string; endsAt: string; durationMinutes: number; status: "todo" | "completed" | "cancelled" };
export type CheckinAssignment = { id: string; title: string; courseId: string; dueAt: string; estimatedMinutes: number; status: string; required: boolean };

export type Slipping = {
  slipping: boolean;
  missed: { count: number; minutes: number };
  notFitting: { id: string; title: string; shortMinutes: number; dueAt: string }[];
  reason: string;
};

/** Only deadlines this close count as "no longer fits" (plans reach at most three weeks ahead). */
export const CHECKIN_WINDOW_DAYS = 14;
const DAY = 86_400_000;

export function detectSlipping(input: { now: number; activeTasks: CheckinBlock[]; completedTasks: CheckinBlock[]; assignments: CheckinAssignment[] }): Slipping {
  const missed = missedBlocks(input.activeTasks, input.now);
  const rows = assignmentTracker({ now: input.now, assignments: input.assignments, completedTasks: input.completedTasks, activeTasks: input.activeTasks, checklists: {} });
  const notFitting = rows
    .filter((r) => r.required && (r.status === "at_risk" || r.status === "unplanned") && r.shortMinutes > 0 && Date.parse(r.dueAt) <= input.now + CHECKIN_WINDOW_DAYS * DAY)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .map((r) => ({ id: r.id, title: r.title, shortMinutes: r.shortMinutes, dueAt: r.dueAt }));
  const missedMinutes = missed.reduce((s, t) => s + t.durationMinutes, 0);

  const parts: string[] = [];
  if (missed.length) parts.push(`${missed.length} block${missed.length === 1 ? "" : "s"} missed (${missedMinutes} min)`);
  for (const item of notFitting.slice(0, 2)) parts.push(`${item.title} no longer fits by ${item.shortMinutes} min`);
  if (notFitting.length > 2) parts.push(`and ${notFitting.length - 2} more`);

  return { slipping: parts.length > 0, missed: { count: missed.length, minutes: missedMinutes }, notFitting, reason: parts.join("; ") };
}

/** The fix to propose: the balanced route when it fits, otherwise deadline first (shown with its shortfall if even that doesn't fit). */
export function chooseRoute(plan: { scenarios: { key: ScenarioKey; feasible: boolean }[] }): ScenarioKey {
  return plan.scenarios.find((s) => s.key === "balanced")?.feasible ? "balanced" : "essential";
}
