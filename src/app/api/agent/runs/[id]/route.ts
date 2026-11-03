import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getAgentRun } from "@/lib/db/agent-runs";
import { route } from "@/lib/http/errors";
import { uuid } from "@/lib/validation/common";

export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ run: await getAgentRun(supabase, uuid.parse((await params).id)) });
});
