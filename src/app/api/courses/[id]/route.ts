import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { deleteCourse, getCourse, updateCourse } from "@/lib/db/courses";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";
import { courseUpdate } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  const id = uuid.parse((await params).id);
  return NextResponse.json({ course: await getCourse(supabase, id) });
});

export const PATCH = route(async (request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const id = uuid.parse((await params).id);
  const input = courseUpdate.parse(await readJson(request));
  return NextResponse.json({ course: await updateCourse(supabase, id, input) });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const id = uuid.parse((await params).id);
  await deleteCourse(supabase, id);
  return new NextResponse(null, { status: 204 });
});
