import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { Passage } from "@/lib/quiz/cloze";
import { EVIDENCE_THRESHOLD } from "@/lib/rag/retrieve";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { analyseExplanation, type ConceptCheck, type TeachFeedback } from "./feedback";

export type TeachAttempt = { id: string; courseId: string; topic: string; coveragePercent: number; concepts: ConceptCheck[]; createdAt: string };

/**
 * Grades an explanation against the student's own course passages for the topic. Retrieval runs with the
 * student's client (RLS + owner filter); without enough evidence it abstains instead of guessing.
 * The attempt is stored by the server so the score can't be forged.
 */
export async function teachBack(deps: { supabase: ServerSupabase; admin: AdminSupabase; userId: string; courseId: string; topic: string; explanation: string }) {
  const { supabase, admin, userId, courseId, topic, explanation } = deps;
  const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) throw new ApiError(404, "not_found", "Course not found.");
  const { data, error } = await supabase.rpc("search_course_chunks", { p_course_id: courseId, p_query: topic, p_limit: 6 });
  if (error) throw fromDbError(error);
  const passages: Passage[] = (data ?? [])
    .filter((r) => (r.lexical_coverage ?? 0) >= EVIDENCE_THRESHOLD.lexicalCoverage || (r.lexical_rank ?? 0) >= EVIDENCE_THRESHOLD.lexicalRank || (r.vector_similarity ?? 0) >= EVIDENCE_THRESHOLD.vectorSimilarity)
    .map((r) => ({ chunkId: r.chunk_id, documentId: r.document_id, filename: r.filename, page: r.page_start, content: r.content }));
  if (!passages.length) {
    throw new ApiError(409, "no_evidence", "We couldn't find this topic in your indexed notes, so there's nothing to check your explanation against. Try the wording your notes use, or upload them first.");
  }
  const feedback: TeachFeedback = analyseExplanation(explanation, passages, topic);
  if (!feedback.concepts.length) {
    throw new ApiError(409, "no_evidence", "Your notes on this topic are too short to pick out key concepts. Try a broader topic.");
  }
  const { data: row, error: insertError } = await admin
    .from("teach_back_attempts")
    .insert({ owner_id: userId, course_id: courseId, topic, explanation, coverage_percent: feedback.coveragePercent, concepts: feedback.concepts as unknown as Json })
    .select("id, created_at")
    .single();
  if (insertError) throw fromDbError(insertError);
  return { id: row.id, createdAt: row.created_at, ...feedback };
}

export async function listTeachBack(supabase: ServerSupabase, limit = 8): Promise<TeachAttempt[]> {
  const { data, error } = await supabase.from("teach_back_attempts").select("id, course_id, topic, coverage_percent, concepts, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw fromDbError(error);
  return data.map((r) => ({ id: r.id, courseId: r.course_id, topic: r.topic, coveragePercent: r.coverage_percent, concepts: r.concepts as unknown as ConceptCheck[], createdAt: r.created_at }));
}
