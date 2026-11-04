import "server-only";
import { z } from "zod";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { isoInstant } from "@/lib/validation/common";

/** One reviewed LMS item, as confirmed by the student (the parsing runs in the browser; see ./lms.ts). */
export const importBody = z
  .object({
    items: z
      .array(
        z
          .object({
            courseTitle: z.string().trim().min(1).max(120),
            title: z.string().trim().min(1).max(200),
            dueAt: isoInstant,
            estimatedMinutes: z.number().int().min(5).max(10080),
            notes: z.string().max(2000).default(""),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type ImportBody = z.infer<typeof importBody>;

const key = (courseId: string, title: string, dueAt: string) => `${courseId}|${title.trim().toLowerCase()}|${Date.parse(dueAt)}`;

/**
 * Adds the confirmed items with the student's own client, so RLS and the composite owner keys apply as for any
 * other write. Courses are matched by name (case-insensitive) among the student's courses, missing ones are
 * created once, and an item already present (same course, title and due time) is skipped, so re-importing the
 * same export is safe.
 */
export async function importAssignments(supabase: ServerSupabase, body: ImportBody) {
  const { data: courses, error } = await supabase.from("courses").select("id, title");
  if (error) throw fromDbError(error);
  const byName = new Map(courses.map((c) => [c.title.trim().toLowerCase(), c.id]));
  const createdCourses: string[] = [];
  for (const title of [...new Set(body.items.map((i) => i.courseTitle.trim()))]) {
    if (byName.has(title.toLowerCase())) continue;
    const { data, error: insertError } = await supabase.from("courses").insert({ title, description: "Imported from an LMS export" }).select("id").single();
    if (insertError) throw fromDbError(insertError);
    byName.set(title.toLowerCase(), data.id);
    createdCourses.push(title);
  }
  const courseIds = [...new Set(body.items.map((i) => byName.get(i.courseTitle.trim().toLowerCase())!))];
  const { data: existing, error: existingError } = await supabase.from("assignments").select("course_id, title, due_at").in("course_id", courseIds);
  if (existingError) throw fromDbError(existingError);
  const seen = new Set(existing.map((e) => key(e.course_id, e.title, e.due_at)));
  const rows = [];
  let skippedDuplicates = 0;
  for (const item of body.items) {
    const courseId = byName.get(item.courseTitle.trim().toLowerCase())!;
    const k = key(courseId, item.title, item.dueAt);
    if (seen.has(k)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(k);
    rows.push({ course_id: courseId, title: item.title, due_at: item.dueAt, estimated_minutes: item.estimatedMinutes, notes: item.notes });
  }
  if (rows.length) {
    const { error: rowsError } = await supabase.from("assignments").insert(rows);
    if (rowsError) throw fromDbError(rowsError);
  }
  return { created: rows.length, createdCourses, skippedDuplicates };
}
