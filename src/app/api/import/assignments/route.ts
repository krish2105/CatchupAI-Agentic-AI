import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { importAssignments, importBody } from "@/lib/import/service";

/** Saves the LMS items the student reviewed and confirmed (up to 200 per request; one rate-limit unit). */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const body = importBody.parse(await readJson(request));
  return NextResponse.json(await importAssignments(supabase, body), { status: 201 });
});
