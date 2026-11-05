import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { removeMember } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

const body = z.object({ userId: z.uuid() }).strict();

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { userId } = body.parse(await readJson(request, 1024));
  await removeMember(supabase, uuid.parse((await params).id), userId);
  return NextResponse.json({ ok: true });
});
