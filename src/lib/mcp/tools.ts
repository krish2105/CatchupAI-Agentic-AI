import "server-only";
import { buildPack } from "@/lib/catchup/pack";
import { fromDbError } from "@/lib/http/errors";
import { confirmedMemories } from "@/lib/memory/service";
import type { AdminSupabase } from "@/lib/supabase/admin";

/**
 * Read-only views of ONE student's data for MCP clients. Every query filters by the owner resolved from the
 * verified token (the admin client bypasses RLS, so these filters are the access control). Nothing here
 * writes: drafting and approving plans stays in the app, behind the student's explicit approval.
 */
export async function overview(admin: AdminSupabase, ownerId: string, now: number) {
  const [courses, assignments] = await Promise.all([
    admin.from("courses").select("id, title").eq("owner_id", ownerId).order("title").limit(50),
    admin.from("assignments").select("title, course_id, due_at, estimated_minutes, required, status").eq("owner_id", ownerId).neq("status", "completed")
      .gte("due_at", new Date(now - 7 * 86400_000).toISOString()).order("due_at").limit(50),
  ]);
  if (courses.error) throw fromDbError(courses.error);
  if (assignments.error) throw fromDbError(assignments.error);
  const titles = new Map(courses.data.map((c) => [c.id, c.title]));
  return {
    courses: courses.data,
    openAssignments: assignments.data.map((a) => ({ title: a.title, course: titles.get(a.course_id) ?? null, dueAt: a.due_at, estimatedMinutes: a.estimated_minutes, required: a.required, overdue: Date.parse(a.due_at) < now })),
  };
}

export async function studyPlan(admin: AdminSupabase, ownerId: string, now: number, days: number) {
  const { data, error } = await admin.from("study_tasks").select("title, kind, starts_at, ends_at, status").eq("owner_id", ownerId).eq("active", true).neq("status", "cancelled")
    .gte("ends_at", new Date(now - 86400_000).toISOString()).lte("starts_at", new Date(now + days * 86400_000).toISOString()).order("starts_at").limit(100);
  if (error) throw fromDbError(error);
  const all = await admin.from("study_tasks").select("status").eq("owner_id", ownerId).eq("active", true).neq("status", "cancelled");
  if (all.error) throw fromDbError(all.error);
  const done = all.data.filter((t) => t.status === "completed").length;
  return {
    hasActivePlan: all.data.length > 0,
    progress: { completedBlocks: done, totalBlocks: all.data.length },
    blocks: data.map((t) => ({ title: t.title, kind: t.kind, startsAt: t.starts_at, endsAt: t.ends_at, status: t.status, missed: t.status === "todo" && Date.parse(t.ends_at) < now })),
  };
}

export async function searchNotes(admin: AdminSupabase, ownerId: string, query: string) {
  // Any of the words may match (ranked by the database); quotes and operators from the client are dropped.
  const words = query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.slice(0, 12) ?? [];
  if (!words.length) return [];
  const { data, error } = await admin.from("document_chunks").select("document_id, page_start, content").eq("owner_id", ownerId)
    .textSearch("content_tsv", words.join(" or "), { type: "websearch", config: "english" }).limit(5);
  if (error) throw fromDbError(error);
  const ids = [...new Set(data.map((c) => c.document_id))];
  const docs = ids.length ? await admin.from("documents").select("id, filename").eq("owner_id", ownerId).in("id", ids) : { data: [], error: null };
  if (docs.error) throw fromDbError(docs.error);
  const names = new Map((docs.data ?? []).map((d) => [d.id, d.filename]));
  return data.map((c) => ({ file: names.get(c.document_id) ?? "document", page: c.page_start, documentId: c.document_id, excerpt: c.content.slice(0, 700) }));
}

export async function catchupPack(admin: AdminSupabase, ownerId: string, documentId: string) {
  const doc = await admin.from("documents").select("id, filename, status").eq("owner_id", ownerId).eq("id", documentId).maybeSingle();
  if (doc.error) throw fromDbError(doc.error);
  if (!doc.data || doc.data.status !== "ready") return null;
  const { data, error } = await admin.from("document_chunks").select("id, page_start, content").eq("owner_id", ownerId).eq("document_id", documentId).order("chunk_index").limit(120);
  if (error) throw fromDbError(error);
  const pack = buildPack(data.map((c) => ({ chunkId: c.id, documentId, filename: doc.data!.filename, page: c.page_start, content: c.content })), documentId);
  return { file: doc.data.filename, ...pack, questions: pack.questions.map(({ prompt, options, page }) => ({ prompt, options, page })) };
}

export async function documents(admin: AdminSupabase, ownerId: string) {
  const { data, error } = await admin.from("documents").select("id, filename, status, page_count, course_id").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return data.map((d) => ({ id: d.id, file: d.filename, ready: d.status === "ready", pages: d.page_count, courseId: d.course_id }));
}

export const memories = (admin: AdminSupabase, ownerId: string) => confirmedMemories(admin, ownerId);
