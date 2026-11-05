import "server-only";
import { LIMITS } from "@/lib/http/rate-limit";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Plan-based limits. A student who belongs to an organisation with an active Class plan gets twice the daily
 * copilot limit; everyone else keeps the standard limit. The plan is read through the student's own client
 * (members may read their organisation's plan columns) and cached per student for 60 s.
 */
const PAID = new Set(["active", "trialing", "past_due"]);
export const CLASS_AGENT_MULTIPLIER = 2;
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; paid: boolean }>();

export function clearPlanCache() {
  cache.clear();
}

export async function onClassPlan(supabase: ServerSupabase, userId: string, now = Date.now()): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.paid;
  const { data, error } = await supabase.from("memberships").select("organizations(plan, plan_status)").eq("user_id", userId);
  // Without the organisation tables (or on any error) the standard limit applies.
  const paid = !error && (data ?? []).some((m) => {
    const o = m.organizations as unknown as { plan?: string; plan_status?: string } | null;
    return o?.plan === "class" && PAID.has(o.plan_status ?? "");
  });
  cache.set(userId, { at: now, paid });
  if (cache.size > 5000) cache.delete(cache.keys().next().value as string);
  return paid;
}

export async function agentDailyLimit(supabase: ServerSupabase, userId: string): Promise<number> {
  return (await onClassPlan(supabase, userId)) ? LIMITS.agent.limit * CLASS_AGENT_MULTIPLIER : LIMITS.agent.limit;
}
