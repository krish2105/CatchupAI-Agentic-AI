import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { toPgVector, type Embedder } from "./embed";

export type ReembedReport = { applied: boolean; model: string; documents: number; chunks: number; updated: number; failed: number };

/**
 * Re-embeds every ready document whose vectors came from another model (or none: keyword-only documents), so
 * semantic search compares vectors from one model only. Needed after the embedding provider changes (e.g.
 * Gemini to OpenAI): both are 1536-dimensional, so old vectors would not error, they would just rank badly.
 * Owner-run with the service role; a dry run unless `apply` is true. `ownerId` limits it to one student.
 */
export async function reembedDocuments({ admin, embedder, ownerId, apply, batch = 32 }: { admin: AdminSupabase; embedder: Embedder; ownerId?: string; apply: boolean; batch?: number }): Promise<ReembedReport> {
  let query = admin.from("documents").select("id, owner_id, embedding_model").eq("status", "ready").or(`embedding_model.is.null,embedding_model.neq.${embedder.model}`);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data: docs, error } = await query;
  if (error) throw fromDbError(error);

  const report: ReembedReport = { applied: apply, model: embedder.model, documents: docs?.length ?? 0, chunks: 0, updated: 0, failed: 0 };
  for (const doc of docs ?? []) {
    const { data: chunks, error: chunkError } = await admin.from("document_chunks").select("id, content").eq("document_id", doc.id).eq("owner_id", doc.owner_id).order("chunk_index");
    if (chunkError) throw fromDbError(chunkError);
    report.chunks += chunks.length;
    if (!apply) continue;
    try {
      for (let i = 0; i < chunks.length; i += batch) {
        const slice = chunks.slice(i, i + batch);
        const vectors = await embedder.embed(slice.map((c) => c.content));
        for (const [j, chunk] of slice.entries()) {
          const res = await admin.from("document_chunks").update({ embedding: toPgVector(vectors[j]) }).eq("id", chunk.id).eq("owner_id", doc.owner_id);
          if (res.error) throw fromDbError(res.error);
        }
      }
      // Only after every chunk has the new vector: the document then reads as embedded by the new model.
      const done = await admin.from("documents").update({ embedding_model: embedder.model }).eq("id", doc.id).eq("owner_id", doc.owner_id);
      if (done.error) throw fromDbError(done.error);
      report.updated++;
    } catch {
      report.failed++;
    }
  }
  return report;
}
