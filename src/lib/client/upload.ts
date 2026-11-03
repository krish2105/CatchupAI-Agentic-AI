"use client";

import type { DocumentDto } from "@/lib/db/documents";
import { browserClient } from "@/lib/supabase/client";
import { api, ClientApiError } from "./api";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Private PDF pipeline used by the vault and syllabus import: register → direct upload to the student's own
 * storage path → server processing. Returns the processed document (status ready or failed with a reason).
 */
export async function uploadAndProcessPdf(courseId: string, file: File, onStage?: (stage: string) => void): Promise<DocumentDto> {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) throw new Error("Only text-based PDF files are supported.");
  if (file.size > MAX_BYTES) throw new Error("PDFs must be 10 MB or smaller.");
  onStage?.(`Registering ${file.name}…`);
  const { document, uploadPath } = await api<{ document: DocumentDto; uploadPath: string }>("/api/documents", {
    method: "POST",
    body: { courseId, filename: file.name, sizeBytes: file.size },
  });
  onStage?.("Uploading privately…");
  const upload = await browserClient().storage.from("course-documents").upload(uploadPath, file, { contentType: "application/pdf", upsert: false });
  if (upload.error) {
    await api(`/api/documents/${document.id}`, { method: "DELETE" }).catch(() => undefined);
    throw new Error("The upload was rejected. Check the file and try again.");
  }
  onStage?.("Extracting text and indexing pages…");
  try {
    return (await api<{ document: DocumentDto }>(`/api/documents/${document.id}/process`, { method: "POST" })).document;
  } catch (e) {
    // 422 = processed but rejected (e.g. scanned PDF); return the document with its reason.
    if (e instanceof ClientApiError && e.status === 422) return (await api<{ document: DocumentDto }>(`/api/documents/${document.id}`)).document;
    throw e;
  }
}
