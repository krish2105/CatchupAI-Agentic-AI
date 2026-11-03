import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { feedbackSchema, saveFeedback } from "@/lib/feedback/service";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

/** 👍/👎 on plans, answers and packs, or a short comment from the feedback form. */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  await saveFeedback(supabase, feedbackSchema.parse(await readJson(request, 8 * 1024)));
  return NextResponse.json({ saved: true }, { status: 201 });
});
