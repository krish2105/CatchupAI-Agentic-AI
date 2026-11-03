import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { submitQuiz } from "@/lib/quiz/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z.object({ answers: z.array(z.number().int().min(0).max(3)).min(1).max(10) }).strict();

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { answers } = body.parse(await readJson(request));
  return NextResponse.json({ result: await submitQuiz({ supabase, admin: adminClient(), userId: user.id, quizId: uuid.parse((await params).id), answers }) });
});
