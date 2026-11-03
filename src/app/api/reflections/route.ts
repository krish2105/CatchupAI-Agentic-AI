import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { saveReflection } from "@/lib/insights/week";

const text = z.string().trim().max(600);
const body = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), wentWell: text, wasHard: text, nextFocus: text }).strict();

/** Saves (or updates) the student's reflection for one week. */
export const PUT = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  return NextResponse.json({ reflection: await saveReflection(supabase, body.parse(await readJson(request))) });
});
