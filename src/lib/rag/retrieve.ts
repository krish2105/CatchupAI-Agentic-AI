import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { bestWindow } from "./best-window";
import { toPgVector, type Embedder } from "./embed";

export type Citation = {
  chunkId: string;
  documentId: string;
  filename: string;
  pageStart: number;
  pageEnd: number;
  snippet: string;
  score: number;
  lexicalRank: number | null;
  lexicalCoverage: number | null;
  vectorSimilarity: number | null;
};

/**
 * Minimum evidence for a passage to count as support; below this the system abstains.
 * Lexical: at least a third of the question's meaningful terms appear in the passage (coverage), or a strong
 * rank. Vector: cosine similarity. Calibrated with `npm run eval`; re-check once real embeddings are enabled.
 */
export const EVIDENCE_THRESHOLD = { lexicalCoverage: 0.34, lexicalRank: 0.08, vectorSimilarity: 0.3 } as const;

/**
 * Cosine similarity needed to count as support, per embedding provider. Gemini embeddings score unrelated text
 * higher than OpenAI's, so its bar is higher. Starting values: re-check with `npm run eval` (RAG abstention cases)
 * once a key is configured. EVIDENCE_VECTOR_THRESHOLD overrides both.
 */
export function vectorThreshold(embedder: Embedder | null) {
  const override = Number(process.env.EVIDENCE_VECTOR_THRESHOLD);
  if (Number.isFinite(override) && override > 0) return override;
  return embedder?.provider === "gemini" ? 0.6 : EVIDENCE_THRESHOLD.vectorSimilarity;
}

/**
 * Searches ONLY the given course of the signed-in student. Runs with the student's client, so RLS and the
 * function's owner filter both apply; a course the student doesn't own simply yields no rows.
 */
export async function searchCourseMaterial(
  supabase: ServerSupabase,
  args: { courseId: string; query: string; topK?: number },
  embedder: Embedder | null,
): Promise<{ citations: Citation[]; abstained: boolean; mode: "hybrid" | "lexical" }> {
  const query = args.query.trim().slice(0, 500);
  let embedding: string | null = null;
  if (embedder) {
    try {
      embedding = toPgVector((await embedder.embed([query]))[0]);
    } catch (e) {
      console.warn("[retrieve] query embedding failed; lexical only", e instanceof Error ? e.message : e);
    }
  }
  const { data, error } = await supabase.rpc("search_course_chunks", {
    p_course_id: args.courseId,
    p_query: query,
    p_query_embedding: embedding ?? undefined,
    p_limit: Math.min(Math.max(args.topK ?? 6, 1), 6),
  });
  if (error) throw fromDbError(error);
  const citations = (data ?? [])
    .filter(
      (r) =>
        (r.lexical_coverage ?? 0) >= EVIDENCE_THRESHOLD.lexicalCoverage ||
        (r.lexical_rank ?? 0) >= EVIDENCE_THRESHOLD.lexicalRank ||
        (r.vector_similarity ?? 0) >= vectorThreshold(embedder),
    )
    .map((r) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      filename: r.filename,
      pageStart: r.page_start,
      pageEnd: r.page_end,
      snippet: bestWindow(r.content, query, 700),
      score: r.score,
      lexicalRank: r.lexical_rank,
      lexicalCoverage: r.lexical_coverage,
      vectorSimilarity: r.vector_similarity,
    }));
  return { citations, abstained: citations.length === 0, mode: embedding ? "hybrid" : "lexical" };
}
