import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { AssignmentCreate } from "@/lib/validation/schemas";
import type { Assignment } from "./types";

const SELECT = "id, course_id, title, notes, due_at, estimated_minutes, required, status, updated_at";

type Row = {
  id: string;
  course_id: string;
  title: string;
  notes: string;
  due_at: string;
  estimated_minutes: number;
  required: boolean;
  status: string;
  updated_at: string;
};

export function toAssignment(row: Row): Assignment {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    notes: row.notes,
    dueAt: row.due_at,
    estimatedMinutes: row.estimated_minutes,
    required: row.required,
    status: row.status as Assignment["status"],
    updatedAt: row.updated_at,
  };
}

/** `ownerId` adds an explicit owner filter on top of RLS (required when a server job reads with the service role). */
export async function listAssignments(supabase: ServerSupabase, opts: { courseId?: string; from?: string; to?: string; ownerId?: string } = {}): Promise<Assignment[]> {
  let query = supabase.from("assignments").select(SELECT).order("due_at");
  if (opts.ownerId) query = query.eq("owner_id", opts.ownerId);
  if (opts.courseId) query = query.eq("course_id", opts.courseId);
  if (opts.from) query = query.gte("due_at", opts.from);
  if (opts.to) query = query.lte("due_at", opts.to);
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return data.map(toAssignment);
}

export async function createAssignment(supabase: ServerSupabase, input: AssignmentCreate): Promise<Assignment> {
  // The composite FK (course_id, owner_id) rejects another student's course with 23503 -> 404.
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      course_id: input.courseId,
      title: input.title,
      notes: input.notes,
      due_at: input.dueAt,
      estimated_minutes: input.estimatedMinutes,
      required: input.required,
      status: input.status,
    })
    .select(SELECT)
    .single();
  if (error) throw fromDbError(error, "Course not found.");
  return toAssignment(data);
}

export async function updateAssignment(supabase: ServerSupabase, id: string, input: Partial<Omit<AssignmentCreate, "courseId">>): Promise<Assignment> {
  const patch: TablesUpdate<"assignments"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.estimatedMinutes !== undefined) patch.estimated_minutes = input.estimatedMinutes;
  if (input.required !== undefined) patch.required = input.required;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabase.from("assignments").update(patch).eq("id", id).select(SELECT).single();
  if (error) throw fromDbError(error, "Assignment not found.");
  return toAssignment(data);
}

export async function deleteAssignment(supabase: ServerSupabase, id: string): Promise<void> {
  const { data, error } = await supabase.from("assignments").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error, "Assignment not found.");
  if (!data?.length) throw fromDbError({ code: "PGRST116" }, "Assignment not found.");
}
