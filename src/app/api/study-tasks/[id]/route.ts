import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { setTaskStatus } from "@/lib/db/tasks";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";

const body = z.object({ status: z.enum(["todo", "completed"]) }).strict();

export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { status } = body.parse(await readJson(request));
  return NextResponse.json({ task: await setTaskStatus(supabase, uuid.parse((await params).id), status) });
});
