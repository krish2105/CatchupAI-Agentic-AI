import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { deleteAssignment, updateAssignment } from "@/lib/db/assignments";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";
import { assignmentUpdate } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const id = uuid.parse((await params).id);
  const input = assignmentUpdate.parse(await readJson(request));
  return NextResponse.json({ assignment: await updateAssignment(supabase, id, input) });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const id = uuid.parse((await params).id);
  await deleteAssignment(supabase, id);
  return new NextResponse(null, { status: 204 });
});
