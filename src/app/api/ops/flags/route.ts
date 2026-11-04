import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/http/errors";
import { logEvent } from "@/lib/observability/log";
import { OpsFlagsInput, requireOpsOwnerApi, updateOpsFlags } from "@/lib/ops/service";
import { adminClient } from "@/lib/supabase/admin";

/** Owner only (others get 404): pause/resume AI, set the daily token budget and an operator note. */
export const POST = route(async (request: Request) => {
  await requireOpsOwnerApi();
  const input = OpsFlagsInput.parse(await readJson(request, 2 * 1024));
  await updateOpsFlags(adminClient(), input);
  logEvent("warn", "ops.flags_changed", { aiEnabled: input.aiEnabled, dailyTokenBudget: input.dailyTokenBudget });
  return NextResponse.json({ ok: true });
});
