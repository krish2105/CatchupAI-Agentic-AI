import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getDocument } from "@/lib/db/documents";
import { ApiError, fromDbError, readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { criteriaWeightTotal, extractRubric } from "@/lib/rubric/extract";
import { uuid } from "@/lib/validation/common";

const body = z.object({ documentId: uuid }).strict();

/**
 * Decodes an indexed assignment brief into checklist candidates. READ-ONLY: nothing is saved here; the
 * student edits and confirms items, which are then saved through the checklist API.
 */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { documentId } = body.parse(await readJson(request));
  const doc = await getDocument(supabase, documentId);
  if (doc.status !== "ready") throw new ApiError(409, "not_ready", "The brief hasn't finished processing.");
  const { data: chunks, error } = await supabase.from("document_chunks").select("page_start, content").eq("document_id", documentId).order("chunk_index");
  if (error) throw fromDbError(error);
  const pages: string[] = [];
  for (const c of chunks) pages[c.page_start - 1] = `${pages[c.page_start - 1] ?? ""}\n${c.content}`;
  const candidates = extractRubric(Array.from(pages, (p) => p ?? ""));
  return NextResponse.json({ documentId, filename: doc.filename, candidates, weightTotal: criteriaWeightTotal(candidates) });
});
