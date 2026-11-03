import "server-only";
import { ApiError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";

export type OpsFlags = { aiEnabled: boolean; dailyTokenBudget: number; note: string | null };
const DEFAULTS: OpsFlags = { aiEnabled: true, dailyTokenBudget: 2_000_000, note: null };
let cache: { at: number; flags: OpsFlags } | null = null;

/** Operator flags (kill switch, daily token budget), cached for 15 s per server instance. */
export async function opsFlags(admin: AdminSupabase, now = Date.now()): Promise<OpsFlags> {
  if (cache && now - cache.at < 15_000) return cache.flags;
  const { data, error } = await admin.from("ops_flags").select("ai_enabled, daily_token_budget, note").eq("id", 1).maybeSingle();
  // If the flags can't be read, fail closed for AI (expensive) work.
  const flags = error ? { ...DEFAULTS, aiEnabled: false, note: "flags unavailable" } : data ? { aiEnabled: data.ai_enabled, dailyTokenBudget: data.daily_token_budget, note: data.note } : DEFAULTS;
  cache = { at: now, flags };
  return flags;
}

export function resetOpsFlagsCache() {
  cache = null;
}

/** Tokens used by all agent runs since 00:00 UTC. */
export async function tokensUsedToday(admin: AdminSupabase, now = Date.now()) {
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await admin.from("agent_runs").select("input_tokens, output_tokens").gte("created_at", since.toISOString()).limit(20000);
  if (error) return Number.POSITIVE_INFINITY;
  return data.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
}

/**
 * Gate in front of every model call. Stops new AI work (never existing data, drafts, schedules or read-only
 * pages) when the operator pauses AI, the daily token budget is spent, or the student already has a run going.
 */
export async function assertAiAvailable(admin: AdminSupabase, userId: string, now = Date.now()) {
  const paused = "The AI copilot is paused right now. Your plans, notes, schedule and practice still work.";
  if (process.env.AI_KILL_SWITCH === "1") throw new ApiError(503, "ai_paused", paused);
  const flags = await opsFlags(admin, now);
  if (!flags.aiEnabled) throw new ApiError(503, "ai_paused", paused);
  if ((await tokensUsedToday(admin, now)) >= flags.dailyTokenBudget) {
    throw new ApiError(503, "ai_budget_reached", "The copilot has reached today's usage limit. It will be back tomorrow; everything else still works.");
  }
  const { data: running } = await admin.from("agent_runs").select("id").eq("owner_id", userId).eq("status", "running").gte("created_at", new Date(now - 2 * 60_000).toISOString()).limit(1);
  if (running?.length) throw new ApiError(429, "run_in_progress", "The copilot is still working on your last request. Wait for it to finish.");
}
