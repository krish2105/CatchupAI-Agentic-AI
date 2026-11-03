import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { addPrerequisite, removePrerequisite } from "@/lib/db/prerequisites";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";

const body = z.object({ requiresCourseId: uuid }).strict();

/** Links this course to a course it builds on (both must belong to the student; cycles are refused). */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { requiresCourseId } = body.parse(await readJson(request));
  await addPrerequisite(supabase, uuid.parse((await params).id), requiresCourseId);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const requires = uuid.parse(new URL(request.url).searchParams.get("requires"));
  await removePrerequisite(supabase, uuid.parse((await params).id), requires);
  return new NextResponse(null, { status: 204 });
});
