import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { getNudgePrefs, nudgePrefsSchema, saveNudgePrefs } from "@/lib/nudges/service";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ prefs: await getNudgePrefs(supabase) });
});

/** Opt in or out of study emails (both off by default). */
export const PUT = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const prefs = nudgePrefsSchema.parse(await readJson(request));
  return NextResponse.json({ prefs: await saveNudgePrefs(supabase, prefs) });
});
