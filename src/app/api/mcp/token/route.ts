import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { ApiError, fromDbError, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { rotateMcpToken } from "@/lib/mcp/token";
import { adminClient } from "@/lib/supabase/admin";

/** Creates a new personal MCP token (replacing any old one). Shown once; demo accounts can't have one. */
export const POST = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "account");
  if (user.isAnonymous) throw new ApiError(403, "demo_account", "Create an account to connect other apps.");
  return NextResponse.json({ token: await rotateMcpToken(adminClient(), user.id) }, { status: 201, headers: { "cache-control": "no-store" } });
});

/** Revokes the token: connected apps lose access immediately. */
export const DELETE = route(async () => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { error } = await supabase.from("mcp_tokens").delete().neq("owner_id", "00000000-0000-0000-0000-000000000000");
  if (error) throw fromDbError(error);
  return new NextResponse(null, { status: 204 });
});
