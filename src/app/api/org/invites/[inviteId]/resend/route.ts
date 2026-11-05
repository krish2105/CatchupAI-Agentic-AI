import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { resendInvite } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

/** Admin: a fresh link for an open invite (the old link stops working). The address isn't stored, so the admin shares it. */
export const POST = route(async (request: Request, { params }: { params: Promise<{ inviteId: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const token = await resendInvite(supabase, uuid.parse((await params).inviteId));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  return NextResponse.json({ link: `${appUrl}/org?invite=${token}` });
});
