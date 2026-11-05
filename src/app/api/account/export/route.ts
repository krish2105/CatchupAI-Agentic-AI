import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { fromDbError, isMissingSchema, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

const TABLES = [
  ["profile", "profiles", "id, display_name, timezone, weekly_minutes, study_start_time, onboarded_at, created_at"],
  ["courses", "courses", "id, title, description, created_at"],
  ["assignments", "assignments", "id, course_id, title, notes, due_at, estimated_minutes, required, status, created_at"],
  ["documents", "documents", "id, course_id, filename, size_bytes, status, page_count, created_at"],
  ["studyPlans", "study_plans", "id, title, scenario, status, feasibility, created_at"],
  ["studyTasks", "study_tasks", "id, plan_id, course_id, title, kind, starts_at, ends_at, status, completed_at"],
  ["proposals", "action_proposals", "id, scenario, status, feasible, created_at, decided_at, payload"],
  ["agentRuns", "agent_runs", "id, request_text, status, summary, tool_events, citations, created_at"],
  ["quizzes", "quizzes", "id, course_id, title, topic, questions, created_at"],
  ["quizAttempts", "quiz_attempts", "id, quiz_id, answers, results, score_percent, created_at"],
  ["focusSessions", "focus_sessions", "id, task_id, planned_minutes, focused_minutes, started_at, ended_at, completed"],
  ["assignmentChecklists", "assignment_checklist_items", "id, assignment_id, kind, text, weight, document_id, page, done, created_at"],
  ["weeklyReflections", "weekly_reflections", "week_start, went_well, was_hard, next_focus, created_at, updated_at"],
  ["calendarFeed", "calendar_feeds", "created_at"],
  ["coursePrerequisites", "course_prerequisites", "course_id, requires_course_id, created_at"],
  ["emailPreferences", "notification_prefs", "daily_digest, missed_alert, last_sent_on, updated_at"],
  ["feedback", "feedback", "id, kind, ref, rating, comment, page, created_at"],
  ["teachBackAttempts", "teach_back_attempts", "id, course_id, topic, explanation, coverage_percent, concepts, created_at"],
] as const;

/** Data portability: everything stored about the signed-in student, read under their own RLS scope. */
export const GET = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email } };
  // Generic read of each table under the student's RLS scope (typed loosely: one loop over many tables).
  const read = supabase as unknown as { from: (t: string) => { select: (c: string) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }> } };
  for (const [key, table, columns] of TABLES) {
    const { data, error } = await read.from(table).select(columns);
    if (error) throw fromDbError(error);
    out[key] = key === "profile" ? (data?.[0] ?? null) : (data ?? []);
  }
  // Own memberships only (staff can see their organisation's roster through RLS; that isn't the student's data).
  const memberships = await supabase.from("memberships").select("org_id, role, share_progress, created_at, organizations(name)").eq("user_id", user.id);
  if (memberships.error && !isMissingSchema(memberships.error)) throw fromDbError(memberships.error);
  out.memberships = memberships.data ?? [];
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="catchup-ai-export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
});
