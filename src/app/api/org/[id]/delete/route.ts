import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { confirmBody, deleteOrganization } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

/** Admin deletes the organisation; the exact name confirms. Students' own study data is not touched. */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { confirmName } = confirmBody.parse(await readJson(request, 1024));
  await deleteOrganization(supabase, uuid.parse((await params).id), confirmName);
  return NextResponse.json({ ok: true });
});
