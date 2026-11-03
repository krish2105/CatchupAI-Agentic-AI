import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { updateChecklistItem } from "@/lib/db/checklist";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";

const body = z
  .object({ done: z.boolean().optional(), text: z.string().trim().min(2).max(400).optional() })
  .strict()
  .refine((b) => b.done !== undefined || b.text !== undefined, "Nothing to update.");

export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const patch = body.parse(await readJson(request));
  return NextResponse.json({ item: await updateChecklistItem(supabase, uuid.parse((await params).id), patch) });
});
