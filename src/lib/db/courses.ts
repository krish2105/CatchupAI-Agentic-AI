import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { CourseCreate } from "@/lib/validation/schemas";
import type { Course } from "./types";

const SELECT = "id, title, description, created_at, assignments(count), documents(count)";

type Row = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  assignments: { count: number }[];
  documents: { count: number }[];
};

function toCourse(row: Row): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    assignmentCount: row.assignments[0]?.count ?? 0,
    documentCount: row.documents[0]?.count ?? 0,
  };
}

/** RLS scopes rows to the signed-in student; no owner filter needed or accepted from callers. */
export async function listCourses(supabase: ServerSupabase): Promise<Course[]> {
  const { data, error } = await supabase.from("courses").select(SELECT).order("created_at");
  if (error) throw fromDbError(error);
  return (data as unknown as Row[]).map(toCourse);
}

export async function getCourse(supabase: ServerSupabase, id: string): Promise<Course> {
  const { data, error } = await supabase.from("courses").select(SELECT).eq("id", id).single();
  if (error) throw fromDbError(error, "Course not found.");
  return toCourse(data as unknown as Row);
}

export async function createCourse(supabase: ServerSupabase, input: CourseCreate): Promise<Course> {
  const { data, error } = await supabase.from("courses").insert({ title: input.title, description: input.description }).select(SELECT).single();
  if (error) throw fromDbError(error);
  return toCourse(data as unknown as Row);
}

export async function updateCourse(supabase: ServerSupabase, id: string, input: Partial<CourseCreate>): Promise<Course> {
  const { data, error } = await supabase.from("courses").update(input).eq("id", id).select(SELECT).single();
  if (error) throw fromDbError(error, "Course not found.");
  return toCourse(data as unknown as Row);
}

export async function deleteCourse(supabase: ServerSupabase, id: string): Promise<void> {
  const { data, error } = await supabase.from("courses").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error, "Course not found.");
  if (!data?.length) throw fromDbError({ code: "PGRST116" }, "Course not found.");
}
