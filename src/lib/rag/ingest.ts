import "server-only";
import { createHash } from "node:crypto";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { chunkPages } from "./chunk";
import { toPgVector, type Embedder } from "./embed";
import { extractPdfPages, PdfError } from "./pdf";

const STALE_PROCESSING_MS = 5 * 60_000;

export type IngestResult = { id: string; status: "ready" | "failed"; pageCount?: number; chunkCount?: number; errorCode?: string; embedded?: boolean };

/**
 * Processes one uploaded PDF. Ownership is established with the STUDENT's client first; the admin client is
 * used only afterwards, always filtered by the verified owner id. Idempotent and safe to retry:
 * - a ready document returns immediately,
 * - a concurrent run cannot claim a document that is already processing (until it is stale),
 * - chunks are replaced, never appended.
 */
export async function processDocument(deps: {
  supabase: ServerSupabase;
  admin: AdminSupabase;
  userId: string;
  documentId: string;
  embedder: Embedder | null;
}): Promise<IngestResult> {
  const { supabase, admin, userId, documentId, embedder } = deps;

  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, course_id, storage_path, status, page_count, chunk_count")
    .eq("id", documentId)
    .single();
  if (error) throw fromDbError(error, "Document not found.");
  if (doc.status === "ready") return { id: doc.id, status: "ready", pageCount: doc.page_count ?? 0, chunkCount: doc.chunk_count ?? 0 };

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("documents")
    .update({ status: "processing", processing_started_at: new Date().toISOString(), error_code: null })
    .eq("id", doc.id)
    .eq("owner_id", userId)
    .or(`status.in.(uploaded,failed),and(status.eq.processing,processing_started_at.lt.${staleBefore})`)
    .select("id");
  if (claimError) throw fromDbError(claimError);
  if (!claimed?.length) throw new ApiError(409, "already_processing", "This document is already being processed.");

  const fail = async (code: string): Promise<IngestResult> => {
    await admin.from("documents").update({ status: "failed", error_code: code, processed_at: new Date().toISOString() }).eq("id", doc.id).eq("owner_id", userId);
    return { id: doc.id, status: "failed", errorCode: code };
  };

  try {
    const download = await supabase.storage.from("course-documents").download(doc.storage_path!);
    if (download.error || !download.data) return await fail("missing_file");
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const pages = await extractPdfPages(bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const { data: dupes } = await supabase.from("documents").select("id").eq("course_id", doc.course_id).eq("sha256", sha256).neq("id", doc.id);
    if (dupes?.length) return await fail("duplicate");

    const chunks = chunkPages(pages);
    let embeddings: number[][] | null = null;
    if (embedder && chunks.length) {
      try {
        embeddings = await embedder.embed(chunks.map((c) => c.content));
      } catch (e) {
        // Keep the document searchable lexically; record that no embeddings were stored.
        console.warn("[ingest] embedding failed; continuing with lexical search only", e instanceof Error ? e.message : e);
        embeddings = null;
      }
    }

    const del = await admin.from("document_chunks").delete().eq("document_id", doc.id).eq("owner_id", userId);
    if (del.error) throw fromDbError(del.error);
    if (chunks.length) {
      const rows = chunks.map((c, i) => ({
        owner_id: userId,
        course_id: doc.course_id,
        document_id: doc.id,
        chunk_index: c.chunkIndex,
        page_start: c.pageStart,
        page_end: c.pageEnd,
        content: c.content,
        embedding: embeddings ? toPgVector(embeddings[i]) : null,
      }));
      const ins = await admin.from("document_chunks").insert(rows);
      if (ins.error) throw fromDbError(ins.error);
    }

    const done = await admin
      .from("documents")
      .update({
        status: "ready",
        sha256,
        page_count: pages.length,
        chunk_count: chunks.length,
        embedding_model: embeddings ? embedder!.model : null,
        processed_at: new Date().toISOString(),
        error_code: null,
      })
      .eq("id", doc.id)
      .eq("owner_id", userId);
    if (done.error) {
      if (done.error.code === "23505") return await fail("duplicate");
      throw fromDbError(done.error);
    }
    return { id: doc.id, status: "ready", pageCount: pages.length, chunkCount: chunks.length, embedded: Boolean(embeddings) };
  } catch (e) {
    if (e instanceof PdfError) return await fail(e.code);
    await fail("processing_error");
    throw e;
  }
}
