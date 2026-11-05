import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { rotateJoinCode } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  return NextResponse.json({ code: await rotateJoinCode(supabase, uuid.parse((await params).id)) });
});
