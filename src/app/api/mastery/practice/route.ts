import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { startPractice } from "@/lib/mastery/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z.object({ documentId: uuid, mode: z.enum(["practice", "rehearsal"]).default("practice") }).strict();

/** Quizmaster: practice on the gaps, or opt-in timed rehearsal on concepts already known. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const input = body.parse(await readJson(request));
  await enforceRateLimit(supabase, "quiz", user);
  return NextResponse.json({ session: await startPractice({ supabase, admin: adminClient(), userId: user.id, ...input }) }, { status: 201 });
});
