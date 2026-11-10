import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { startDiagnostic } from "@/lib/mastery/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

const body = z.object({ documentId: uuid }).strict();

/** Diagnostician: a short warm-up (one question per key concept) written from the student's own lecture. */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const { documentId } = body.parse(await readJson(request));
  await enforceRateLimit(supabase, "quiz", user);
  return NextResponse.json({ session: await startDiagnostic({ supabase, admin: adminClient(), userId: user.id, documentId }) }, { status: 201 });
});
