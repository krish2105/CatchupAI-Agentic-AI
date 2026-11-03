import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createCourse, listCourses } from "@/lib/db/courses";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { courseCreate } from "@/lib/validation/schemas";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ courses: await listCourses(supabase) });
});

export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const input = courseCreate.parse(await readJson(request));
  return NextResponse.json({ course: await createCourse(supabase, input) }, { status: 201 });
});
