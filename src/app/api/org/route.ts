import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { createOrganization, orgName } from "@/lib/org/service";

export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { name } = orgName.parse(await readJson(request));
  return NextResponse.json({ id: await createOrganization(supabase, name) }, { status: 201 });
});
