import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { draftCatchupPlan } from "@/lib/catchup/service";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z.object({ documentId: uuid }).strict();

/** Drafts (never saves) a plan with a catch-up block for the chosen lecture; the student approves in the lab. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { documentId } = body.parse(await readJson(request));
  const proposal = await draftCatchupPlan({ supabase, admin: adminClient(), userId: user.id, documentId, now: Date.now() });
  return NextResponse.json({ proposal: { id: proposal.id, feasible: proposal.feasible } }, { status: 201 });
});
