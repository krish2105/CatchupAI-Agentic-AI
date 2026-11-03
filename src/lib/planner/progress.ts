import type { WorkItem } from "./engine";

type DoneTask = { assignmentId: string | null; durationMinutes: number };
type PlanTask = { status: "todo" | "completed" | "cancelled"; endsAt: string; durationMinutes: number };

/**
 * Remaining work after progress: minutes already completed in study blocks for an assignment are
 * subtracted from its estimate, and fully covered items drop out (so a replan never reschedules done work).
 */
export function applyCompletedWork(items: WorkItem[], completed: DoneTask[]): WorkItem[] {
  const done = new Map<string, number>();
  for (const t of completed) if (t.assignmentId) done.set(t.assignmentId, (done.get(t.assignmentId) ?? 0) + t.durationMinutes);
  return items.flatMap((item) => {
    const minutes = item.assignmentId ? Math.max(0, item.minutes - (done.get(item.assignmentId) ?? 0)) : item.minutes;
    if (minutes === 0) return [];
    return [minutes === item.minutes ? item : { ...item, minutes, rationale: `${item.rationale} ${item.minutes - minutes} min already completed.` }];
  });
}

/** Blocks of the active plan whose time has passed without being completed. */
export function missedBlocks<T extends PlanTask>(tasks: T[], now: number): T[] {
  return tasks.filter((t) => t.status === "todo" && Date.parse(t.endsAt) <= now);
}
