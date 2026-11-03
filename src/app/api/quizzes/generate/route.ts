import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { createQuiz } from "@/lib/quiz/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z
  .object({
    courseId: uuid,
    topic: z.string().trim().min(2).max(120).nullable(),
    focusTerms: z.array(z.string().trim().min(2).max(40).regex(/^[A-Za-z][A-Za-z_-]*$/)).max(5).optional(),
  })
  .strict();

export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const input = body.parse(await readJson(request));
  await enforceRateLimit(supabase, "quiz");
  return NextResponse.json({ quiz: await createQuiz({ supabase, admin: adminClient(), userId: user.id, ...input }) }, { status: 201 });
});
