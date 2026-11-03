import "server-only";
import { getDocument } from "@/lib/db/documents";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { WorkItem } from "@/lib/planner/engine";
import { createProposal, type ProposalDto } from "@/lib/planner/service";
import type { Passage } from "@/lib/quiz/cloze";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { buildPack, type CatchupPack } from "./pack";

/** Builds the pack from one of the student's own indexed documents (RLS applies to every read). */
export async function getCatchupPack(supabase: ServerSupabase, documentId: string): Promise<{ pack: CatchupPack; filename: string; courseId: string }> {
  const doc = await getDocument(supabase, documentId);
  if (doc.status !== "ready") throw new ApiError(409, "not_ready", "This document hasn't finished processing yet.");
  const { data, error } = await supabase.from("document_chunks").select("id, page_start, content").eq("document_id", documentId).order("chunk_index").limit(120);
  if (error) throw fromDbError(error);
  const passages: Passage[] = data.map((c) => ({ chunkId: c.id, documentId, filename: doc.filename, page: c.page_start, content: c.content }));
  return { pack: buildPack(passages, documentId), filename: doc.filename, courseId: doc.courseId };
}

/**
 * Drafts a plan that includes a 30-minute catch-up block for the lecture (before the course's next deadline,
 * otherwise within three days). Like every plan, it's only a proposal until the student approves it.
 */
export async function draftCatchupPlan(deps: { supabase: ServerSupabase; admin: AdminSupabase; userId: string; documentId: string; now: number }): Promise<ProposalDto> {
  const { pack, filename, courseId } = await getCatchupPack(deps.supabase, deps.documentId);
  const { data: next } = await deps.supabase.from("assignments").select("due_at").eq("course_id", courseId).neq("status", "completed").gt("due_at", new Date(deps.now + 3600_000).toISOString()).order("due_at").limit(1);
  const deadline = next?.[0]?.due_at ?? new Date(deps.now + 3 * 86400_000).toISOString();
  const pages = [...new Set(pack.summary.map((s) => s.page))].slice(0, 3);
  const item: WorkItem = {
    id: `catchup:${deps.documentId}`,
    kind: "study",
    title: `Catch up: ${filename}`,
    courseId,
    assignmentId: null,
    minutes: pack.plan.reduce((s, b) => s + b.minutes, 0),
    deadline,
    tier: "required",
    evidence: pages.map((page) => ({ documentId: deps.documentId, page, filename })),
    rationale: "Catch-up pack for a missed lecture: summary, key terms and check questions.",
  };
  const balanced = await createProposal({ ...deps, scenario: "balanced", extraItems: [item] });
  return balanced.feasible ? balanced : createProposal({ ...deps, scenario: "essential", extraItems: [item] });
}
