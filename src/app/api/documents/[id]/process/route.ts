import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getDocument } from "@/lib/db/documents";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { getEmbedder } from "@/lib/rag/embed";
import { processDocument } from "@/lib/rag/ingest";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

export const maxDuration = 60;

/** Step 2 of upload (and retry): extract, chunk and index. Idempotent. */
export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "upload", user);
  const documentId = uuid.parse((await params).id);
  const result = await processDocument({ supabase, admin: adminClient(), userId: user.id, documentId, embedder: getEmbedder() });
  const { storagePath: _omit, ...document } = await getDocument(supabase, documentId);
  void _omit;
  return NextResponse.json({ document }, { status: result.status === "ready" ? 200 : 422 });
});
