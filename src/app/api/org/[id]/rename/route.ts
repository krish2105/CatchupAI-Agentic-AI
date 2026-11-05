import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { orgName, renameOrganization } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { name } = orgName.parse(await readJson(request, 1024));
  await renameOrganization(supabase, uuid.parse((await params).id), name);
  return NextResponse.json({ ok: true });
});
