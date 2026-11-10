import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { takeHint } from "@/lib/mastery/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z.object({ itemId: uuid, level: z.union([z.literal(1), z.literal(2)]) }).strict();

/** Hints before answers: first a pointer, then the page's sentence with the answer blanked. Never after answering. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const input = body.parse(await readJson(request));
  await enforceRateLimit(supabase, "write", user);
  return NextResponse.json({ hint: await takeHint({ supabase, admin: adminClient(), userId: user.id, ...input }) });
});
