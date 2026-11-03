import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { deleteDocument, getDocument } from "@/lib/db/documents";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uuid } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  const { storagePath: _omit, ...document } = await getDocument(supabase, uuid.parse((await params).id));
  void _omit;
  return NextResponse.json({ document });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  await deleteDocument(supabase, uuid.parse((await params).id));
  return new NextResponse(null, { status: 204 });
});
