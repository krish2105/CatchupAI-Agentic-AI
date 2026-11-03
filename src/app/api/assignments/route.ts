import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createAssignment, listAssignments } from "@/lib/db/assignments";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { isoInstant, uuid } from "@/lib/validation/common";
import { assignmentCreate } from "@/lib/validation/schemas";

const query = z.object({ courseId: uuid.optional(), from: isoInstant.optional(), to: isoInstant.optional() });

export const GET = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  const params = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  return NextResponse.json({ assignments: await listAssignments(supabase, params) });
});

export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const input = assignmentCreate.parse(await readJson(request));
  return NextResponse.json({ assignment: await createAssignment(supabase, input) }, { status: 201 });
});
