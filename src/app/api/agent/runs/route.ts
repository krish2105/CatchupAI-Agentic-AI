import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { listAgentRuns } from "@/lib/db/agent-runs";
import { route } from "@/lib/http/errors";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ runs: await listAgentRuns(supabase) });
});
