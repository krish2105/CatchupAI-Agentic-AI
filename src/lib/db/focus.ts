import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export type FocusSession = { id: string; taskId: string | null; plannedMinutes: number; focusedMinutes: number; startedAt: string; endedAt: string; completed: boolean };

const SELECT = "id, task_id, planned_minutes, focused_minutes, started_at, ended_at, completed";
type Row = { id: string; task_id: string | null; planned_minutes: number; focused_minutes: number; started_at: string; ended_at: string; completed: boolean };
const toSession = (r: Row): FocusSession => ({ id: r.id, taskId: r.task_id, plannedMinutes: r.planned_minutes, focusedMinutes: r.focused_minutes, startedAt: r.started_at, endedAt: r.ended_at, completed: r.completed });

export async function listFocusSessions(supabase: ServerSupabase, sinceIso: string): Promise<FocusSession[]> {
  const { data, error } = await supabase.from("focus_sessions").select(SELECT).gte("started_at", sinceIso).order("started_at", { ascending: false });
  if (error) throw fromDbError(error);
  return data.map(toSession);
}

/** Records a finished session. Times are checked against the server clock; task ownership by FK + RLS. */
export async function recordFocusSession(
  supabase: ServerSupabase,
  input: { taskId: string | null; plannedMinutes: number; focusedMinutes: number; startedAt: string; completed: boolean; markTaskDone: boolean },
  now: number,
): Promise<FocusSession> {
  const started = Date.parse(input.startedAt);
  if (started > now + 60_000 || started < now - 6 * 3600_000) throw new ApiError(400, "invalid_input", "Session start time is out of range.");
  if (input.focusedMinutes > Math.ceil((now - started) / 60_000) + 1) throw new ApiError(400, "invalid_input", "Focused time is longer than the session.");
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({ task_id: input.taskId, planned_minutes: input.plannedMinutes, focused_minutes: input.focusedMinutes, started_at: new Date(started).toISOString(), ended_at: new Date(now).toISOString(), completed: input.completed })
    .select(SELECT)
    .single();
  if (error) throw fromDbError(error, "Study block not found.");
  if (input.markTaskDone && input.taskId) {
    const { error: tErr } = await supabase.from("study_tasks").update({ status: "completed" }).eq("id", input.taskId);
    if (tErr) throw fromDbError(tErr, "Study block not found.");
  }
  return toSession(data);
}
