import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { opsFlags, resetOpsFlagsCache, tokensUsedToday } from "@/lib/ai/guard";
import { requireApiUser, requirePageUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { listErrorGroups, type ErrorGroup } from "@/lib/observability/app-errors";
import type { AdminSupabase } from "@/lib/supabase/admin";

/**
 * Operator ("owner") access for /ops. Owners are the exact email addresses in OPS_OWNER_EMAILS (comma
 * separated, plain config). Anonymous demo users are never owners. Everyone else gets a not-found, so the
 * page's existence isn't revealed.
 */
export function isOpsOwner(user: { email?: string | null; is_anonymous?: boolean | null }) {
  const owners = (process.env.OPS_OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = user.email?.trim().toLowerCase();
  return Boolean(email) && !user.is_anonymous && owners.includes(email!);
}

export async function requireOpsOwnerPage() {
  const { supabase, user } = await requirePageUser("/ops");
  if (!isOpsOwner(user)) notFound();
  return { supabase, user };
}

export async function requireOpsOwnerApi() {
  const { supabase, user } = await requireApiUser();
  if (!isOpsOwner(user)) throw new ApiError(404, "not_found", "Not found.");
  return { supabase, user };
}

export const OpsFlagsInput = z.object({
  aiEnabled: z.boolean(),
  dailyTokenBudget: z.number().int().min(0).max(100_000_000),
  note: z.string().trim().max(300).nullable(),
}).strict();

export async function updateOpsFlags(admin: AdminSupabase, input: z.input<typeof OpsFlagsInput>) {
  const v = OpsFlagsInput.parse(input);
  const { error } = await admin.from("ops_flags").update({ ai_enabled: v.aiEnabled, daily_token_budget: v.dailyTokenBudget, note: v.note || null }).eq("id", 1);
  if (error) throw error;
  resetOpsFlagsCache();
}

export type OpsSnapshot = {
  ai: { enabled: boolean; envKillSwitch: boolean; budget: number; tokensToday: number; note: string | null };
  runsToday: { total: number; failed: number; fellBack: number; cachedCalls: number };
  errorGroups: ErrorGroup[];
};

export async function opsSnapshot(admin: AdminSupabase, now: number): Promise<OpsSnapshot> {
  resetOpsFlagsCache();
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  const [flags, tokens, runs, errorGroups] = await Promise.all([
    opsFlags(admin, now),
    tokensUsedToday(admin, now),
    admin.from("agent_runs").select("status, fallback_reason, tool_events").gte("created_at", since.toISOString()).limit(5000),
    listErrorGroups(admin, { limit: 50 }),
  ]);
  const rows = runs.data ?? [];
  return {
    ai: { enabled: flags.aiEnabled, envKillSwitch: process.env.AI_KILL_SWITCH === "1", budget: flags.dailyTokenBudget, tokensToday: Number.isFinite(tokens) ? tokens : 0, note: flags.note },
    runsToday: {
      total: rows.length,
      failed: rows.filter((r) => r.status === "failed").length,
      fellBack: rows.filter((r) => r.fallback_reason).length,
      cachedCalls: rows.reduce((s, r) => s + (Array.isArray(r.tool_events) ? (r.tool_events as { cached?: boolean }[]).filter((e) => e?.cached).length : 0), 0),
    },
    errorGroups,
  };
}

export { uptimeHistory, type UptimeRun } from "@/lib/status/uptime";
