import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getDocument } from "@/lib/db/documents";
import { ApiError, route } from "@/lib/http/errors";
import { uuid } from "@/lib/validation/common";

/** Permission-checked, short-lived (2 min) link to the private PDF, opened at the cited page. */
export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  const doc = await getDocument(supabase, uuid.parse((await params).id));
  const { page } = z.object({ page: z.coerce.number().int().min(1).max(500).optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
  const signed = await supabase.storage.from("course-documents").createSignedUrl(doc.storagePath, 120);
  if (signed.error || !signed.data) throw new ApiError(404, "not_found", "Document not found.");
  return NextResponse.redirect(`${signed.data.signedUrl}${page ? `#page=${page}` : ""}`, { status: 302 });
});
