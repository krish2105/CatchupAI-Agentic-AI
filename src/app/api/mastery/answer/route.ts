import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { answerItem } from "@/lib/mastery/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z
  .object({
    itemId: uuid,
    // null = the time ran out (timed rehearsal only).
    chosen: z.number().int().min(0).max(3).nullable(),
    confidence: z.enum(["sure", "think", "guess"]),
    elapsedMs: z.number().int().min(0).max(3_600_000),
  })
  .strict();

/** Grades one answer once (the key never leaves the server) and updates the concept's mastery. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const input = body.parse(await readJson(request));
  await enforceRateLimit(supabase, "write", user);
  return NextResponse.json({ result: await answerItem({ supabase, admin: adminClient(), userId: user.id, ...input }) });
});
