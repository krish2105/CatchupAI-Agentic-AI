import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getActivePlan } from "@/lib/db/tasks";
import { route } from "@/lib/http/errors";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ plan: await getActivePlan(supabase) });
});
