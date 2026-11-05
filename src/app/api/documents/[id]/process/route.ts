import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getDocument } from "@/lib/db/documents";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { agentDailyLimit } from "@/lib/billing/plan-limits";
import { getEmbedder } from "@/lib/rag/embed";
import { getOcr } from "@/lib/rag/ocr";
import { processDocument } from "@/lib/rag/ingest";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

// OCR of a scan can take up to 90 s (OCR_LIMITS.timeoutMs).
export const maxDuration = 120;

/** Step 2 of upload (and retry): extract, chunk and index. Idempotent. */
export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "upload", user);
  const documentId = uuid.parse((await params).id);
  const reader = getOcr();
  // Reading a scan is a model call, so it uses one of the student's daily copilot requests.
  const ocr = reader ? { reader, beforeUse: async () => enforceRateLimit(supabase, "agent", user, { limit: await agentDailyLimit(supabase, user.id) }) } : null;
  const result = await processDocument({ supabase, admin: adminClient(), userId: user.id, documentId, embedder: getEmbedder(), ocr });
  const { storagePath: _omit, ...document } = await getDocument(supabase, documentId);
  void _omit;
  return NextResponse.json({ document }, { status: result.status === "ready" ? 200 : 422 });
});
