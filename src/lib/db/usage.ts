import "server-only";
import { fromDbError } from "@/lib/http/errors";
import { DEMO_LIMITS, LIMITS } from "@/lib/http/rate-limit";
import type { ServerSupabase } from "@/lib/supabase/server";

export type UsageRow = { label: string; used: number; limit: number; window: string };

/** The student's own usage against their limits, counted from their rows (no content, just counts). */
export async function getUsage(supabase: ServerSupabase, isAnonymous: boolean, now: number): Promise<UsageRow[]> {
  const pick = (k: keyof typeof LIMITS) => (isAnonymous ? DEMO_LIMITS[k] : undefined) ?? LIMITS[k];
  const day = new Date(now - 86400_000).toISOString();
  const hour = new Date(now - 3600_000).toISOString();
  const [runs, docs, quizzes, teach] = await Promise.all([
    supabase.from("agent_runs").select("id", { count: "exact", head: true }).gte("created_at", day),
    supabase.from("documents").select("id", { count: "exact", head: true }).gte("created_at", hour),
    supabase.from("quizzes").select("id", { count: "exact", head: true }).gte("created_at", day),
    supabase.from("teach_back_attempts").select("id", { count: "exact", head: true }).gte("created_at", day),
  ]);
  for (const r of [runs, docs, quizzes, teach]) if (r.error) throw fromDbError(r.error);
  return [
    { label: "AI copilot runs", used: runs.count ?? 0, limit: pick("agent").limit, window: "last 24 hours" },
    { label: "Document uploads", used: docs.count ?? 0, limit: Math.floor(pick("upload").limit / 2), window: "last hour" },
    { label: "Knowledge checks", used: quizzes.count ?? 0, limit: pick("quiz").limit, window: "last 24 hours" },
    { label: "Teach-it-back checks", used: teach.count ?? 0, limit: pick("teach").limit, window: "last 24 hours" },
  ];
}
