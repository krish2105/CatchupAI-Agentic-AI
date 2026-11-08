import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { checkinPrefSchema, getCheckinPref, saveCheckinPref } from "@/lib/checkin/service";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ enabled: await getCheckinPref(supabase) });
});

/** Turn the daily check-in on or off (on by default). */
export const PUT = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { enabled } = checkinPrefSchema.parse(await readJson(request));
  return NextResponse.json({ enabled: await saveCheckinPref(supabase, enabled) });
});
