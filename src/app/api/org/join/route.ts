import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { joinCode, joinOrganization } from "@/lib/org/service";

/** Join by code (rate-limited like other writes, which also slows code guessing). */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { code } = joinCode.parse(await readJson(request));
  return NextResponse.json({ id: await joinOrganization(supabase, code) });
});
