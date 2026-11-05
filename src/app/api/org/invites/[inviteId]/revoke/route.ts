import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { revokeInvite } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

export const POST = route(async (_request: Request, { params }: { params: Promise<{ inviteId: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  await revokeInvite(supabase, uuid.parse((await params).inviteId));
  return NextResponse.json({ ok: true });
});
