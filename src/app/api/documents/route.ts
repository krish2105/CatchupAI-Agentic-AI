import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createDocument, listDocuments } from "@/lib/db/documents";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";
import { documentCreate } from "@/lib/validation/documents";

export const GET = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  const { courseId } = z.object({ courseId: uuid.optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
  return NextResponse.json({ documents: await listDocuments(supabase, courseId) });
});

/** Step 1 of upload: registers the document and returns the private storage path for the browser upload. */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "upload");
  const input = documentCreate.parse(await readJson(request));
  return NextResponse.json(await createDocument(supabase, input), { status: 201 });
});
