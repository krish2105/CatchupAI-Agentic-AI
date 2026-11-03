import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { listFocusSessions, recordFocusSession } from "@/lib/db/focus";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { isoInstant, uuid } from "@/lib/validation/common";

const body = z
  .object({
    taskId: uuid.nullable(),
    plannedMinutes: z.number().int().min(5).max(180),
    focusedMinutes: z.number().int().min(0).max(240),
    startedAt: isoInstant,
    completed: z.boolean(),
    markTaskDone: z.boolean().default(false),
  })
  .strict();

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ sessions: await listFocusSessions(supabase, new Date(Date.now() - 14 * 86400_000).toISOString()) });
});

export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const input = body.parse(await readJson(request));
  return NextResponse.json({ session: await recordFocusSession(supabase, input, Date.now()) }, { status: 201 });
});
