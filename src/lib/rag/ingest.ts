import "server-only";
import { logEvent } from "@/lib/observability/log";
import { createHash } from "node:crypto";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { chunkPages } from "./chunk";
import { toPgVector, type Embedder } from "./embed";
import { assertAiBudget } from "@/lib/ai/guard";
import { OCR_LIMITS, type Ocr, type OcrUsage } from "./ocr";
import { extractPdfPages, PDF_LIMITS, PdfError } from "./pdf";

const STALE_PROCESSING_MS = 5 * 60_000;

export type IngestResult = { id: string; status: "ready" | "failed"; pageCount?: number; chunkCount?: number; errorCode?: string; embedded?: boolean; ocr?: boolean };

/** OCR for scans: the reader, and a check run just before it is used (the student's daily AI limit). */
export type IngestOcr = { reader: Ocr; beforeUse?: () => Promise<void> };

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
  /** When set, a PDF without selectable text is read with OCR instead of failing (migration 0021). */
  ocr?: IngestOcr | null;
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
    logEvent("warn", "ingest.failed", { documentId: doc.id, code });
    return { id: doc.id, status: "failed", errorCode: code };
  };

  /** Tokens of an OCR call that didn't produce a usable document still count towards the daily budget. */
  const recordOcrTokens = async (model: string, usage: OcrUsage) => {
    await admin.from("documents").update({ text_source: "ocr", ocr_model: model, ocr_input_tokens: usage.inputTokens, ocr_output_tokens: usage.outputTokens }).eq("id", doc.id).eq("owner_id", userId);
  };

  /** OCR of a scan, or the failure code to store. Never throws for an AI-side problem: the upload fails visibly. */
  const readScan = async (ocr: IngestOcr, bytes: Uint8Array, pageCount: number): Promise<{ pages: string[]; model: string; usage: OcrUsage } | { code: string; model: string; usage?: OcrUsage }> => {
    const model = ocr.reader.model;
    if (pageCount > OCR_LIMITS.maxPages) return { code: "ocr_too_many_pages", model };
    // Without migration 0021 the result couldn't be stored or counted: behave as before (no OCR).
    const { error: schema } = await admin.from("documents").select("text_source").limit(0);
    if (schema) return { code: "no_text", model };
    try {
      await assertAiBudget(admin);
      await ocr.beforeUse?.();
    } catch (e) {
      if (e instanceof ApiError) return { code: "ocr_unavailable", model };
      throw e;
    }
    try {
      const result = await ocr.reader.read(bytes, pageCount);
      if (result.pages.join("").length < PDF_LIMITS.minTextChars) return { code: "no_text", model, usage: result.usage };
      return { pages: result.pages, model, usage: result.usage };
    } catch (e) {
      logEvent("warn", "ingest.ocr_failed", { documentId: doc.id, model, status: (e as { status?: number }).status ?? null, error: e instanceof Error ? e.name : "unknown" });
      return { code: "no_text", model, usage: (e as { usage?: OcrUsage }).usage };
    }
  };

  try {
    const download = await supabase.storage.from("course-documents").download(doc.storage_path!);
    if (download.error || !download.data) return await fail("missing_file");
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    // Before any parsing or OCR, so a duplicate never costs an AI call.
    const { data: dupes } = await supabase.from("documents").select("id").eq("course_id", doc.course_id).eq("sha256", sha256).neq("id", doc.id);
    if (dupes?.length) return await fail("duplicate");

    let pages: string[];
    let ocrUsed: { model: string; usage: OcrUsage } | null = null;
    try {
      pages = await extractPdfPages(bytes);
    } catch (e) {
      if (!(e instanceof PdfError) || e.code !== "no_text" || !deps.ocr) throw e;
      const read = await readScan(deps.ocr, bytes, e.pageCount ?? 0);
      if ("code" in read) {
        if (read.usage) await recordOcrTokens(read.model, read.usage);
        return await fail(read.code);
      }
      pages = read.pages;
      ocrUsed = { model: read.model, usage: read.usage };
    }

    const chunks = chunkPages(pages);
    let embeddings: number[][] | null = null;
    if (embedder && chunks.length) {
      try {
        embeddings = await embedder.embed(chunks.map((c) => c.content));
      } catch (e) {
        // Keep the document searchable lexically; record that no embeddings were stored.
        logEvent("warn", "ingest.embedding_failed", { documentId: doc.id, error: e instanceof Error ? e.name : "unknown" });
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
        ...(ocrUsed ? { text_source: "ocr" as const, ocr_model: ocrUsed.model, ocr_input_tokens: ocrUsed.usage.inputTokens, ocr_output_tokens: ocrUsed.usage.outputTokens } : {}),
      })
      .eq("id", doc.id)
      .eq("owner_id", userId);
    if (done.error) {
      if (done.error.code === "23505") return await fail("duplicate");
      throw fromDbError(done.error);
    }
    if (ocrUsed) logEvent("info", "ingest.ocr", { documentId: doc.id, model: ocrUsed.model, pages: pages.length, inputTokens: ocrUsed.usage.inputTokens, outputTokens: ocrUsed.usage.outputTokens });
    return { id: doc.id, status: "ready", pageCount: pages.length, chunkCount: chunks.length, embedded: Boolean(embeddings), ...(ocrUsed ? { ocr: true } : {}) };
  } catch (e) {
    if (e instanceof PdfError) return await fail(e.code);
    await fail("processing_error");
    throw e;
  }
}
