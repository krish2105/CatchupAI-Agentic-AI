import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { approveProposal } from "@/lib/planner/service";
import { uuid } from "@/lib/validation/common";

const key = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

/** The human approval gate: atomic and idempotent (same result for retries and double clicks). */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const id = uuid.parse((await params).id);
  const idempotencyKey = key.parse(request.headers.get("idempotency-key"));
  const result = await approveProposal(supabase, id, idempotencyKey);
  return NextResponse.json({ status: "approved", ...result }, { status: result.alreadyApplied ? 200 : 201 });
});
