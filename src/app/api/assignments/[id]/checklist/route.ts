import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { replaceChecklist } from "@/lib/db/checklist";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";

const item = z
  .object({
    kind: z.enum(["criterion", "deadline", "deliverable", "requirement"]),
    text: z.string().trim().min(2).max(400),
    weight: z.number().int().min(1).max(100).nullable(),
    page: z.number().int().min(1).max(500).nullable(),
  })
  .strict();
const body = z.object({ documentId: uuid.nullable(), items: z.array(item).max(30) }).strict();

/** Saves the checklist the student confirmed for one of their assignments (replaces the previous one). */
export const PUT = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { documentId, items } = body.parse(await readJson(request));
  return NextResponse.json({ items: await replaceChecklist(supabase, uuid.parse((await params).id), documentId, items) });
});
