import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

/** Completed vs total tasks in the active plan, or null when there is no active plan. */
export async function getMilestone(supabase: ServerSupabase): Promise<{ completed: number; total: number } | null> {
  const { data, error } = await supabase.from("study_tasks").select("status").eq("active", true).neq("status", "cancelled");
  if (error) throw fromDbError(error);
  if (!data.length) return null;
  return { completed: data.filter((t) => t.status === "completed").length, total: data.length };
}
