import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { roleBody, setMemberRole } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { userId, role } = roleBody.parse(await readJson(request));
  await setMemberRole(supabase, uuid.parse((await params).id), userId, role);
  return NextResponse.json({ ok: true });
});
