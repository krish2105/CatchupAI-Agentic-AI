import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { computePlan } from "@/lib/planner/service";

const query = z.object({ weeklyMinutes: z.coerce.number().int().min(0).max(5040).optional() });

/** Read-only: computes the three deterministic scenarios (optionally with a what-if weekly total). */
export const GET = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const { weeklyMinutes } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  // Each call runs retrieval per course and the scheduler; bound it like any other expensive operation.
  await enforceRateLimit(supabase, "compute");
  const plan = await computePlan(supabase, user.id, { now: Date.now(), weeklyTotal: weeklyMinutes });
  return NextResponse.json({ plan });
});
