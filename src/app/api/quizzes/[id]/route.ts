import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { getQuiz } from "@/lib/quiz/service";
import { uuid } from "@/lib/validation/common";

export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ quiz: await getQuiz(supabase, uuid.parse((await params).id)) });
});
