import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { ApiError, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { briefStudent } from "@/lib/coach/night";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

/** "Check now": the Night Coach runs for the signed-in student straight away (replacing today's brief). */
export const POST = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "quiz", user);
  const brief = await briefStudent({ admin: adminClient(), ownerId: user.id, now: Date.now(), replace: true });
  if (!brief) throw new ApiError(409, "conflict", "The Night Coach is already running. Try again in a moment.");
  return NextResponse.json({ brief }, { status: 201 });
});

const query = z.object({ id: uuid });

/** Dismiss a brief (the student's own row only, through RLS). */
export const DELETE = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  const { id } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { error } = await supabase.from("coach_briefs").delete().eq("id", id);
  if (error) throw new ApiError(500, "internal", "Couldn't dismiss the brief.");
  return new NextResponse(null, { status: 204 });
});
