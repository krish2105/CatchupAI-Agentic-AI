import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { addMemory, listMemories, memoryText } from "@/lib/memory/service";

export const GET = route(async () => {
  const { supabase } = await requireApiUser();
  return NextResponse.json({ memories: await listMemories(supabase) });
});

/** The student adds something for the copilot to remember. */
export const POST = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { text } = z.object({ text: memoryText }).strict().parse(await readJson(request));
  return NextResponse.json({ memory: await addMemory(supabase, text) }, { status: 201 });
});
