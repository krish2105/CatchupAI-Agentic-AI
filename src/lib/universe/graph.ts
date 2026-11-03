import type { NodeStatus, UniverseGraph, UniverseTopic } from "@/components/three/types";
import type { Assignment, Course } from "@/lib/db/types";

export type TaskSummary = { courseId: string; status: "todo" | "completed" | "cancelled" };
export type DocumentSummary = { id: string; courseId: string; filename: string; status: string };

/**
 * Builds the 3D universe purely from the student's records. Status rules (no invented scores):
 * - needs_work: a required, incomplete assignment is overdue
 * - mastered: every assignment is completed (and there is at least one)
 * - on_track: the active plan has tasks for this course
 * - no_data: otherwise
 * progress = completed / total active-plan tasks for the course, or null without a plan.
 */
export function buildUniverseGraph(
  courses: Course[],
  assignments: Assignment[],
  tasks: TaskSummary[] = [],
  documents: DocumentSummary[] = [],
  now = Date.now(),
): UniverseGraph {
  return {
    nodes: courses.map((course) => {
      const own = assignments.filter((a) => a.courseId === course.id);
      const ownTasks = tasks.filter((t) => t.courseId === course.id && t.status !== "cancelled");
      const overdue = own.filter((a) => a.required && a.status !== "completed" && new Date(a.dueAt).getTime() < now);
      const completedTasks = ownTasks.filter((t) => t.status === "completed").length;
      const progress = ownTasks.length ? Math.round((completedTasks / ownTasks.length) * 100) : null;
      let status: NodeStatus = "no_data";
      if (overdue.length) status = "needs_work";
      else if (own.length && own.every((a) => a.status === "completed")) status = "mastered";
      else if (ownTasks.length) status = "on_track";

      const topics: UniverseTopic[] = [
        ...own.map((a) => ({
          id: a.id,
          label: a.title,
          kind: "assignment" as const,
          status: (a.status === "completed" ? "mastered" : overdue.includes(a) ? "needs_work" : "on_track") as NodeStatus,
        })),
        ...documents
          .filter((d) => d.courseId === course.id)
          .map((d) => ({ id: d.id, label: d.filename, kind: "document" as const, status: (d.status === "ready" ? "on_track" : "no_data") as NodeStatus })),
      ];

      const upcoming = own.filter((a) => a.status !== "completed" && new Date(a.dueAt).getTime() >= now).length;
      const parts = [
        `${own.length} assignment${own.length === 1 ? "" : "s"}${upcoming ? ` (${upcoming} upcoming)` : ""}`,
        `${documents.filter((d) => d.courseId === course.id).length} document(s)`,
      ];
      if (overdue.length) parts.push(`${overdue.length} overdue`);
      const nextDueAt = own.filter((a) => a.status !== "completed" && new Date(a.dueAt).getTime() >= now).map((a) => a.dueAt).sort()[0] ?? null;
      return { id: course.id, label: course.title, status, progress, summary: parts.join(" · ") + ".", href: `/courses/${course.id}`, nextDueAt, topics };
    }),
  };
}
