import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { rotateFeed } from "@/lib/calendar/service";
import { fromDbError, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

/** Creates or replaces the private subscription link. The full URL is shown once; only a hash is kept. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const token = await rotateFeed(adminClient(), user.id);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  return NextResponse.json({ url: `${base}/api/calendar/feed/${token}` }, { status: 201 });
});

/** Revokes the link immediately (calendar apps stop receiving updates). */
export const DELETE = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { error } = await supabase.from("calendar_feeds").delete().eq("owner_id", user.id);
  if (error) throw fromDbError(error);
  return new NextResponse(null, { status: 204 });
});
