import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/errors";
import { resolveErrorGroup } from "@/lib/observability/app-errors";
import { requireOpsOwnerApi } from "@/lib/ops/service";
import { adminClient } from "@/lib/supabase/admin";

const fingerprint = z.string().regex(/^[0-9a-f]{16}$/);

/** Owner only: mark an error group resolved. If it happens again it reopens and alerts again. */
export const POST = route(async (_request: Request, { params }: { params: Promise<{ fingerprint: string }> }) => {
  await requireOpsOwnerApi();
  await resolveErrorGroup(adminClient(), fingerprint.parse((await params).fingerprint));
  return NextResponse.json({ ok: true });
});
