import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { acceptInvite, tokenBody } from "@/lib/org/service";

/** The signed-in invitee accepts; the database checks the token, expiry, seats and that their email matches. */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { token } = tokenBody.parse(await readJson(request, 1024));
  return NextResponse.json({ orgId: await acceptInvite(supabase, token) });
});
