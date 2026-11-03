import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { createProposal } from "@/lib/planner/service";
import { adminClient } from "@/lib/supabase/admin";

const body = z.object({ scenario: z.enum(["essential", "balanced", "full"]) }).strict();

/** Drafts a pending proposal for review. Recomputed server-side from saved data; nothing is scheduled yet. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { scenario } = body.parse(await readJson(request));
  const proposal = await createProposal({ supabase, admin: adminClient(), userId: user.id, scenario, now: Date.now() });
  return NextResponse.json({ proposal }, { status: 201 });
});
