import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { RubricKind } from "@/lib/rubric/extract";
import type { ServerSupabase } from "@/lib/supabase/server";

export type ChecklistItem = { id: string; assignmentId: string; kind: RubricKind; text: string; weight: number | null; documentId: string | null; page: number | null; done: boolean };
export type ChecklistInput = { kind: RubricKind; text: string; weight: number | null; page: number | null };

const SELECT = "id, assignment_id, kind, text, weight, document_id, page, done, position";
type Row = { id: string; assignment_id: string; kind: string; text: string; weight: number | null; document_id: string | null; page: number | null; done: boolean };
const toItem = (r: Row): ChecklistItem => ({ id: r.id, assignmentId: r.assignment_id, kind: r.kind as RubricKind, text: r.text, weight: r.weight, documentId: r.document_id, page: r.page, done: r.done });

/** Checklists of the signed-in student's assignments (RLS), grouped by assignment. */
export async function listChecklists(supabase: ServerSupabase, assignmentIds: string[]): Promise<Record<string, ChecklistItem[]>> {
  if (!assignmentIds.length) return {};
  const { data, error } = await supabase.from("assignment_checklist_items").select(SELECT).in("assignment_id", assignmentIds).order("position");
  if (error) throw fromDbError(error);
  const out: Record<string, ChecklistItem[]> = {};
  for (const r of data) (out[r.assignment_id] ??= []).push(toItem(r));
  return out;
}

/**
 * Replaces an assignment's checklist with the items the student confirmed. New items are inserted before the
 * old ones are removed, so a failed save never leaves the student with an empty checklist.
 */
export async function replaceChecklist(supabase: ServerSupabase, assignmentId: string, documentId: string | null, items: ChecklistInput[]) {
  const { data: assignment } = await supabase.from("assignments").select("id").eq("id", assignmentId).maybeSingle();
  if (!assignment) throw new ApiError(404, "not_found", "Assignment not found.");
  if (documentId) {
    const { data: doc } = await supabase.from("documents").select("id").eq("id", documentId).maybeSingle();
    if (!doc) throw new ApiError(404, "not_found", "Brief not found.");
  }
  const { data: old, error: oldError } = await supabase.from("assignment_checklist_items").select("id").eq("assignment_id", assignmentId);
  if (oldError) throw fromDbError(oldError);
  const rows = items.map((it, position) => ({ assignment_id: assignmentId, kind: it.kind, text: it.text, weight: it.weight, document_id: it.page ? documentId : null, page: documentId ? it.page : null, position }));
  const { data, error } = rows.length ? await supabase.from("assignment_checklist_items").insert(rows).select(SELECT) : { data: [], error: null };
  if (error) throw fromDbError(error);
  if (old.length) {
    const { error: delError } = await supabase.from("assignment_checklist_items").delete().in("id", old.map((o) => o.id));
    if (delError) throw fromDbError(delError);
  }
  return (data as Row[]).map(toItem);
}

export async function updateChecklistItem(supabase: ServerSupabase, id: string, patch: { done?: boolean; text?: string }) {
  const { data, error } = await supabase.from("assignment_checklist_items").update(patch).eq("id", id).select(SELECT).single();
  if (error) throw fromDbError(error, "Checklist item not found.");
  return toItem(data);
}
