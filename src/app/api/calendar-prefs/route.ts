import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { calendarPrefsSchema, getCalendarPrefs, saveCalendarPrefs } from "@/lib/calendar-prefs/service";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ prefs: await getCalendarPrefs(supabase) });
});

/** Save the Local calendar card (every religious setting is off until the student turns it on). */
export const PUT = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const prefs = calendarPrefsSchema.parse(await readJson(request));
  return NextResponse.json({ prefs: await saveCalendarPrefs(supabase, prefs) });
});
