import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { teachBack } from "@/lib/teach/service";
import { uuid } from "@/lib/validation/common";

const body = z
  .object({
    courseId: uuid,
    topic: z.string().trim().min(2).max(120),
    explanation: z.string().trim().min(1).max(4000),
  })
  .strict();

export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const input = body.parse(await readJson(request));
  await enforceRateLimit(supabase, "teach");
  return NextResponse.json({ attempt: await teachBack({ supabase, admin: adminClient(), userId: user.id, ...input }) }, { status: 201 });
});
