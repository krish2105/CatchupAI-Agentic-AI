import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { getMasteryMap } from "@/lib/mastery/service";
import { uuid } from "@/lib/validation/common";

const query = z.object({ documentId: uuid });

/** The student's mastery map for one lecture: per-concept status and the bridge (gaps in the order to work on). */
export const GET = route(async (request: Request) => {
  const { supabase } = await requireApiUser();
  const { documentId } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  return NextResponse.json({ map: await getMasteryMap(supabase, documentId) });
});
