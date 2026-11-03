import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import { PDF_ERROR_MESSAGES, type PdfErrorCode } from "@/lib/rag/pdf";
import type { ServerSupabase } from "@/lib/supabase/server";

export const DOCUMENT_QUOTA = { perCourse: 20, perUser: 60 } as const;

export type DocumentDto = {
  id: string;
  courseId: string;
  filename: string;
  sizeBytes: number;
  status: "uploaded" | "processing" | "ready" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
  pageCount: number | null;
  chunkCount: number | null;
  searchMode: "hybrid" | "lexical" | null;
  createdAt: string;
};

const SELECT = "id, course_id, filename, size_bytes, status, error_code, page_count, chunk_count, embedding_model, created_at";

const EXTRA_ERRORS: Record<string, string> = {
  duplicate: "This exact file is already in this course.",
  missing_file: "The upload didn't finish. Remove it and upload again.",
  processing_error: "Processing failed unexpectedly. Try again.",
};

type Row = { id: string; course_id: string; filename: string; size_bytes: number; status: string; error_code: string | null; page_count: number | null; chunk_count: number | null; embedding_model: string | null; created_at: string };

export function toDocument(row: Row): DocumentDto {
  const code = row.error_code;
  return {
    id: row.id,
    courseId: row.course_id,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    status: row.status as DocumentDto["status"],
    errorCode: code,
    errorMessage: code ? (PDF_ERROR_MESSAGES[code as PdfErrorCode] ?? EXTRA_ERRORS[code] ?? "Processing failed.") : null,
    pageCount: row.page_count,
    chunkCount: row.chunk_count,
    searchMode: row.status === "ready" ? (row.embedding_model ? "hybrid" : "lexical") : null,
    createdAt: row.created_at,
  };
}

export async function listDocuments(supabase: ServerSupabase, courseId?: string): Promise<DocumentDto[]> {
  let q = supabase.from("documents").select(SELECT).order("created_at");
  if (courseId) q = q.eq("course_id", courseId);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data.map(toDocument);
}

export async function getDocument(supabase: ServerSupabase, id: string): Promise<DocumentDto & { storagePath: string }> {
  const { data, error } = await supabase.from("documents").select(`${SELECT}, storage_path`).eq("id", id).single();
  if (error) throw fromDbError(error, "Document not found.");
  return { ...toDocument(data), storagePath: data.storage_path! };
}

export async function createDocument(supabase: ServerSupabase, input: { courseId: string; filename: string; sizeBytes: number }) {
  const [{ count: userCount }, { count: courseCount }] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("course_id", input.courseId),
  ]);
  if ((userCount ?? 0) >= DOCUMENT_QUOTA.perUser) throw new ApiError(409, "quota_exceeded", `You can store up to ${DOCUMENT_QUOTA.perUser} documents.`);
  if ((courseCount ?? 0) >= DOCUMENT_QUOTA.perCourse) throw new ApiError(409, "quota_exceeded", `A course can hold up to ${DOCUMENT_QUOTA.perCourse} documents.`);
  const { data, error } = await supabase
    .from("documents")
    .insert({ course_id: input.courseId, filename: input.filename, size_bytes: input.sizeBytes })
    .select(`${SELECT}, storage_path`)
    .single();
  if (error) throw fromDbError(error, "Course not found.");
  return { document: toDocument(data), uploadPath: data.storage_path! };
}

export async function deleteDocument(supabase: ServerSupabase, id: string) {
  const doc = await getDocument(supabase, id);
  await supabase.storage.from("course-documents").remove([doc.storagePath]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw fromDbError(error, "Document not found.");
}
