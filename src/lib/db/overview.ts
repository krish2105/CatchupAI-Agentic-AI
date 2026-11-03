import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { buildUniverseGraph, type DocumentSummary, type TaskSummary } from "@/lib/universe/graph";
import { listAssignments } from "./assignments";
import { listCourses } from "./courses";
import { listPrerequisites } from "./prerequisites";

/** Everything the dashboard and universe need, read once under the student's RLS scope. */
export async function getOverview(supabase: ServerSupabase) {
  const [courses, assignments, tasksRes, docsRes, prerequisites] = await Promise.all([
    listCourses(supabase),
    listAssignments(supabase),
    supabase.from("study_tasks").select("course_id, status").eq("active", true),
    supabase.from("documents").select("id, course_id, filename, status"),
    listPrerequisites(supabase),
  ]);
  if (tasksRes.error) throw fromDbError(tasksRes.error);
  if (docsRes.error) throw fromDbError(docsRes.error);
  const tasks: TaskSummary[] = tasksRes.data.map((t) => ({ courseId: t.course_id, status: t.status as TaskSummary["status"] }));
  const documents: DocumentSummary[] = docsRes.data.map((d) => ({ id: d.id, courseId: d.course_id, filename: d.filename, status: d.status }));
  const now = Date.now();
  const horizon = now + 14 * 86400_000;
  const upcomingCount = assignments.filter((a) => {
    const due = new Date(a.dueAt).getTime();
    return a.status !== "completed" && due >= now && due <= horizon;
  }).length;
  const built = buildUniverseGraph(courses, assignments, tasks, documents, now);
  const graph = { nodes: built.nodes.map((n) => ({ ...n, requires: prerequisites.filter((e) => e.courseId === n.id).map((e) => e.requiresId) })) };
  return { now, courses, assignments, tasks, documents, upcomingCount, prerequisites, graph };
}
