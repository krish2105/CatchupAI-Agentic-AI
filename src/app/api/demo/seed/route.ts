import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { seedDemoAccount } from "@/lib/demo/seed";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { getEmbedder } from "@/lib/rag/embed";
import { adminClient } from "@/lib/supabase/admin";
import { timeZone } from "@/lib/validation/common";

export const maxDuration = 60;

const body = z.object({ timezone: timeZone }).strict();

/** Loads the synthetic demo scenario into the visitor's fresh anonymous account. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "upload");
  const { timezone } = body.parse(await readJson(request));
  const result = await seedDemoAccount({ supabase, admin: adminClient(), userId: user.id, isAnonymous: user.isAnonymous, timezone, now: Date.now(), embedder: getEmbedder() });
  return NextResponse.json(result);
});
