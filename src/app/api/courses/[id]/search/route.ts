import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/db/courses";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { getEmbedder } from "@/lib/rag/embed";
import { searchCourseMaterial } from "@/lib/rag/retrieve";
import { uuid } from "@/lib/validation/common";
import { searchQuery } from "@/lib/validation/documents";

/** Evidence search: returns real passages with page citations, or abstains. No generated text. */
export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const courseId = uuid.parse((await params).id);
  await getCourse(supabase, courseId);
  const { q } = searchQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  const result = await searchCourseMaterial(supabase, { courseId, query: q }, getEmbedder());
  return NextResponse.json({
    ...result,
    citations: result.citations.map(({ chunkId, documentId, filename, pageStart, pageEnd, snippet }) => ({ chunkId, documentId, filename, pageStart, pageEnd, snippet })),
  });
});
