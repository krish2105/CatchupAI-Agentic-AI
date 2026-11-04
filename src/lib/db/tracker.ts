import "server-only";
import { listAssignments } from "@/lib/db/assignments";
import { listChecklists } from "@/lib/db/checklist";
import { listFocusSessions } from "@/lib/db/focus";
import { getActivePlan } from "@/lib/db/tasks";
import { fromDbError } from "@/lib/http/errors";
import { assignmentTracker, weekSummary, type TrackerRow, type WeekSummary } from "@/lib/insights/tracker";
import type { ServerSupabase } from "@/lib/supabase/server";

export type TrackerData = { rows: TrackerRow[]; week: WeekSummary; courseNames: Record<string, string> };

/** Everything the recovery tracker shows, read through the student's own client (RLS). */
export async function getTracker(supabase: ServerSupabase, timezone: string, now: number): Promise<TrackerData> {
  const [assignments, plan, completed, focus, courses] = await Promise.all([
    listAssignments(supabase),
    getActivePlan(supabase),
    supabase.from("study_tasks").select("assignment_id, starts_at, ends_at, duration_minutes, status").eq("status", "completed").not("assignment_id", "is", null).limit(5000),
    listFocusSessions(supabase, new Date(now - 8 * 86400_000).toISOString()),
    supabase.from("courses").select("id, title"),
  ]);
  if (completed.error) throw fromDbError(completed.error);
  const checklistItems = await listChecklists(supabase, assignments.map((a) => a.id));
  const checklists = Object.fromEntries(Object.entries(checklistItems).map(([id, items]) => [id, { done: items.filter((i) => i.done).length, total: items.length }]));
  const tasks = plan?.tasks ?? [];
  const rows = assignmentTracker({
    now,
    assignments: assignments.map((a) => ({ id: a.id, title: a.title, courseId: a.courseId, dueAt: a.dueAt, estimatedMinutes: a.estimatedMinutes, status: a.status, required: a.required })),
    completedTasks: completed.data.map((t) => ({ assignmentId: t.assignment_id, startsAt: t.starts_at, endsAt: t.ends_at, durationMinutes: t.duration_minutes ?? 0, status: "completed" as const })),
    activeTasks: tasks.map((t) => ({ assignmentId: t.assignmentId, startsAt: t.startsAt, endsAt: t.endsAt, durationMinutes: t.durationMinutes, status: t.status })),
    checklists,
  });
  const week = weekSummary({ now, timezone, tasks: tasks.map((t) => ({ assignmentId: t.assignmentId, startsAt: t.startsAt, endsAt: t.endsAt, durationMinutes: t.durationMinutes, status: t.status, completedAt: t.completedAt })), focus });
  return { rows, week, courseNames: Object.fromEntries((courses.data ?? []).map((c) => [c.id, c.title])) };
}
