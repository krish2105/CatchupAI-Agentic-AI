import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { wouldCreateCycle, type PrereqEdge } from "@/lib/universe/prerequisites";

export async function listPrerequisites(supabase: ServerSupabase): Promise<PrereqEdge[]> {
  const { data, error } = await supabase.from("course_prerequisites").select("course_id, requires_course_id");
  if (error) throw fromDbError(error);
  return data.map((r) => ({ courseId: r.course_id, requiresId: r.requires_course_id }));
}

/** Adds "course builds on requires" for the student's own courses; refuses cycles. */
export async function addPrerequisite(supabase: ServerSupabase, courseId: string, requiresId: string) {
  const edges = await listPrerequisites(supabase);
  if (wouldCreateCycle(edges, courseId, requiresId)) throw new ApiError(409, "cycle", "That link would create a loop: one of these courses already builds on the other.");
  const { error } = await supabase.from("course_prerequisites").insert({ course_id: courseId, requires_course_id: requiresId });
  if (error) throw fromDbError(error, "Course not found.");
}

export async function removePrerequisite(supabase: ServerSupabase, courseId: string, requiresId: string) {
  const { error } = await supabase.from("course_prerequisites").delete().eq("course_id", courseId).eq("requires_course_id", requiresId);
  if (error) throw fromDbError(error);
}
