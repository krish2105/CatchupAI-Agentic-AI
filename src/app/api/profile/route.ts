import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getProfile, updateProfile } from "@/lib/db/profiles";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { profileUpdate } from "@/lib/validation/schemas";

export const GET = route(async () => {
  const { supabase, user } = await requireApiUser();
  return NextResponse.json({ profile: await getProfile(supabase, user.id) });
});

export const PATCH = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const input = profileUpdate.parse(await readJson(request));
  return NextResponse.json({ profile: await updateProfile(supabase, user.id, input) });
});
