import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { listQuizzes } from "@/lib/quiz/service";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ quizzes: await listQuizzes(supabase) });
});
