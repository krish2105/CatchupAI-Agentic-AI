import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getDocument } from "@/lib/db/documents";
import { getProfile } from "@/lib/db/profiles";
import { ApiError, fromDbError, readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { extractSyllabusDeadlines } from "@/lib/syllabus/extract";
import { uuid } from "@/lib/validation/common";

const body = z.object({ documentId: uuid }).strict();

/**
 * Proposes deadlines found in an indexed syllabus. READ-ONLY: nothing is saved here; the student reviews and
 * confirms each candidate, which is then created through the normal assignments API.
 */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { documentId } = body.parse(await readJson(request));
  const doc = await getDocument(supabase, documentId);
  if (doc.status !== "ready") throw new ApiError(409, "not_ready", "The syllabus hasn't finished processing.");
  const { data: chunks, error } = await supabase.from("document_chunks").select("page_start, content").eq("document_id", documentId).order("chunk_index");
  if (error) throw fromDbError(error);
  const pages: string[] = [];
  for (const c of chunks) pages[c.page_start - 1] = `${pages[c.page_start - 1] ?? ""}\n${c.content}`;
  const profile = await getProfile(supabase, user.id);
  const candidates = extractSyllabusDeadlines(Array.from(pages, (p) => p ?? ""), { timezone: profile.timezone, now: Date.now() });
  return NextResponse.json({ courseId: doc.courseId, filename: doc.filename, timezone: profile.timezone, candidates });
});
