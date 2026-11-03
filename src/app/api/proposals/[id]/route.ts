import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { getProposal } from "@/lib/planner/service";
import { uuid } from "@/lib/validation/common";

export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ proposal: await getProposal(supabase, uuid.parse((await params).id), Date.now()) });
});
