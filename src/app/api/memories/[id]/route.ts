import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { deleteMemory, memoryText, updateMemory } from "@/lib/memory/service";
import { uuid } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };
const patch = z.object({ text: memoryText.optional(), confirm: z.literal(true).optional() }).strict().refine((p) => p.text !== undefined || p.confirm, { message: "Nothing to change." });

/** Edit a memory, or confirm one the copilot suggested. */
export const PATCH = route(async (request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const id = uuid.parse((await params).id);
  return NextResponse.json({ memory: await updateMemory(supabase, id, patch.parse(await readJson(request))) });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  await deleteMemory(supabase, uuid.parse((await params).id));
  return new NextResponse(null, { status: 204 });
});
