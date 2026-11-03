import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export type StudyTask = {
  id: string;
  planId: string;
  courseId: string;
  assignmentId: string | null;
  title: string;
  kind: "assignment" | "study" | "review";
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: "todo" | "completed" | "cancelled";
  evidence: { documentId: string; page: number; filename?: string }[];
  completedAt: string | null;
};

export type ActivePlan = { id: string; proposalId: string; title: string; scenario: string; createdAt: string; feasibility: Record<string, unknown>; tasks: StudyTask[] };

const TASK_SELECT = "id, plan_id, course_id, assignment_id, title, kind, starts_at, ends_at, duration_minutes, status, evidence, completed_at";

type TaskRow = {
  id: string; plan_id: string; course_id: string; assignment_id: string | null; title: string; kind: string;
  starts_at: string; ends_at: string; duration_minutes: number | null; status: string; evidence: unknown; completed_at: string | null;
};

function toTask(r: TaskRow): StudyTask {
  return {
    id: r.id,
    planId: r.plan_id,
    courseId: r.course_id,
    assignmentId: r.assignment_id,
    title: r.title,
    kind: r.kind as StudyTask["kind"],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    durationMinutes: r.duration_minutes ?? 0,
    status: r.status as StudyTask["status"],
    evidence: Array.isArray(r.evidence) ? (r.evidence as StudyTask["evidence"]) : [],
    completedAt: r.completed_at,
  };
}

export async function getActivePlan(supabase: ServerSupabase): Promise<ActivePlan | null> {
  const { data: plan, error } = await supabase.from("study_plans").select("id, proposal_id, title, scenario, created_at, feasibility").eq("status", "active").maybeSingle();
  if (error) throw fromDbError(error);
  if (!plan) return null;
  const { data: tasks, error: tErr } = await supabase.from("study_tasks").select(TASK_SELECT).eq("plan_id", plan.id).order("starts_at");
  if (tErr) throw fromDbError(tErr);
  return { id: plan.id, proposalId: plan.proposal_id, title: plan.title, scenario: plan.scenario, createdAt: plan.created_at, feasibility: plan.feasibility as Record<string, unknown>, tasks: tasks.map(toTask) };
}

export async function setTaskStatus(supabase: ServerSupabase, id: string, status: "todo" | "completed"): Promise<StudyTask> {
  const { data, error } = await supabase.from("study_tasks").update({ status }).eq("id", id).select(TASK_SELECT).single();
  if (error) throw fromDbError(error, "Task not found.");
  return toTask(data);
}
