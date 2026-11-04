import { localDate } from "@/lib/planner/month";

/**
 * Recovery tracker (pure, client-safe). Built for students who are behind, following the research notes:
 * per-assignment progress (progress towards one goal, not one big backlog number), honest states from real
 * minutes, and a forgiving week count ("days studied of 7", fresh start each Monday) instead of a streak.
 */
type Assignment = { id: string; title: string; courseId: string; dueAt: string; estimatedMinutes: number; status: string; required: boolean };
type Block = { assignmentId: string | null; startsAt: string; endsAt: string; durationMinutes: number; status: "todo" | "completed" | "cancelled" };

export type TrackerStatus = "overdue" | "at_risk" | "unplanned" | "on_track" | "done";
export type TrackerRow = {
  id: string;
  title: string;
  courseId: string;
  dueAt: string;
  required: boolean;
  estimatedMinutes: number;
  /** Minutes completed in study blocks for this assignment (any plan, approved or superseded). */
  doneMinutes: number;
  /** Minutes still scheduled in the active plan that end before the deadline. */
  scheduledMinutes: number;
  /** Minutes neither done nor scheduled before the deadline. */
  shortMinutes: number;
  percent: number;
  status: TrackerStatus;
  checklist: { done: number; total: number } | null;
};

const ORDER: Record<TrackerStatus, number> = { overdue: 0, at_risk: 1, unplanned: 2, on_track: 3, done: 4 };

export function assignmentTracker(input: {
  now: number;
  assignments: Assignment[];
  completedTasks: Block[];
  activeTasks: Block[];
  checklists: Record<string, { done: number; total: number }>;
}): TrackerRow[] {
  const rows = input.assignments.map((a): TrackerRow => {
    const due = Date.parse(a.dueAt);
    const doneMinutes = input.completedTasks.filter((t) => t.assignmentId === a.id && t.status === "completed").reduce((s, t) => s + t.durationMinutes, 0);
    const scheduledMinutes = input.activeTasks
      .filter((t) => t.assignmentId === a.id && t.status === "todo" && Date.parse(t.endsAt) > input.now && Date.parse(t.endsAt) <= due)
      .reduce((s, t) => s + t.durationMinutes, 0);
    const estimate = Math.max(0, a.estimatedMinutes);
    const finished = a.status === "completed" || (estimate > 0 && doneMinutes >= estimate);
    const shortMinutes = finished ? 0 : Math.max(0, estimate - doneMinutes - scheduledMinutes);
    const status: TrackerStatus = finished ? "done" : due <= input.now ? "overdue" : shortMinutes === 0 ? "on_track" : scheduledMinutes > 0 ? "at_risk" : "unplanned";
    const percent = finished ? 100 : estimate > 0 ? Math.min(100, Math.round((doneMinutes / estimate) * 100)) : 0;
    return { id: a.id, title: a.title, courseId: a.courseId, dueAt: a.dueAt, required: a.required, estimatedMinutes: estimate, doneMinutes, scheduledMinutes, shortMinutes, percent, status, checklist: input.checklists[a.id] ?? null };
  });
  return rows.sort((x, y) => ORDER[x.status] - ORDER[y.status] || Date.parse(x.dueAt) - Date.parse(y.dueAt));
}

export type WeekSummary = { weekStart: string; daysStudied: number; plannedMinutes: number; doneMinutes: number; focusMinutes: number; missedBlocks: number; upcomingBlocks: number };

/** This local week (Monday to Sunday). A day counts as studied if a block was completed or focus time was logged. */
export function weekSummary(input: {
  now: number;
  timezone: string;
  tasks: (Block & { completedAt: string | null })[];
  focus: { startedAt: string; focusedMinutes: number }[];
}): WeekSummary {
  const today = localDate(input.now, input.timezone);
  const t = Date.parse(`${today}T00:00:00Z`);
  const weekStart = new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.parse(`${weekStart}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const inWeek = (iso: string) => {
    const d = localDate(iso, input.timezone);
    return d >= weekStart && d < weekEnd;
  };
  const blocks = input.tasks.filter((b) => b.status !== "cancelled" && inWeek(b.startsAt));
  const focus = input.focus.filter((f) => inWeek(f.startedAt));
  const studied = new Set<string>();
  for (const b of blocks) if (b.status === "completed") studied.add(localDate(b.completedAt ?? b.endsAt, input.timezone));
  for (const f of focus) if (f.focusedMinutes > 0) studied.add(localDate(f.startedAt, input.timezone));
  return {
    weekStart,
    daysStudied: [...studied].filter((d) => d >= weekStart && d < weekEnd).length,
    plannedMinutes: blocks.reduce((s, b) => s + b.durationMinutes, 0),
    doneMinutes: blocks.filter((b) => b.status === "completed").reduce((s, b) => s + b.durationMinutes, 0),
    focusMinutes: focus.reduce((s, f) => s + f.focusedMinutes, 0),
    missedBlocks: blocks.filter((b) => b.status === "todo" && Date.parse(b.endsAt) <= input.now).length,
    upcomingBlocks: blocks.filter((b) => b.status === "todo" && Date.parse(b.endsAt) > input.now).length,
  };
}
