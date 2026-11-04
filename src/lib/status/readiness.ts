import "server-only";
import { opsFlags } from "@/lib/ai/guard";
import { runtimeInfo } from "@/lib/agents/runtime";
import { adminClient } from "@/lib/supabase/admin";

export type Readiness = { database: "ok" | "down"; databaseMs: number; ai: "enabled" | "paused" | "not_configured"; version: string };

/**
 * Can this deployment serve students right now? One database round trip, plus whether AI is available
 * (configured, not paused by the operator). Reveals no hosts, keys or configuration values.
 * Used by /api/health/ready (uptime checks) and the public /status page.
 */
export async function readiness(): Promise<Readiness> {
  const started = Date.now();
  let database: Readiness["database"] = "down";
  let ai: Readiness["ai"] = runtimeInfo().kind === "none" ? "not_configured" : "enabled";
  let databaseMs = 0;
  try {
    const admin = adminClient();
    const { error } = await admin.from("courses").select("id", { count: "exact", head: true }).limit(1);
    databaseMs = Date.now() - started;
    database = error ? "down" : "ok";
    if (ai === "enabled" && (process.env.AI_KILL_SWITCH === "1" || !(await opsFlags(admin)).aiEnabled)) ai = "paused";
  } catch {
    database = "down";
  }
  return { database, databaseMs, ai, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" };
}
