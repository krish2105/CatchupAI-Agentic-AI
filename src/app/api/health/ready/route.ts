import { NextResponse } from "next/server";
import { opsFlags } from "@/lib/ai/guard";
import { runtimeInfo } from "@/lib/agents/runtime";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Readiness: can this deployment serve students right now? Checks the database and reports whether AI is
 * available. Liveness stays at /api/health. Reveals no hosts, versions of dependencies, or configuration values.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "down" = "down";
  let ai: "enabled" | "paused" | "not_configured" = runtimeInfo().kind === "none" ? "not_configured" : "enabled";
  try {
    const admin = adminClient();
    const { error } = await admin.from("courses").select("id", { count: "exact", head: true }).limit(1);
    database = error ? "down" : "ok";
    if (ai === "enabled" && (process.env.AI_KILL_SWITCH === "1" || !(await opsFlags(admin)).aiEnabled)) ai = "paused";
  } catch {
    database = "down";
  }
  const ready = database === "ok";
  return NextResponse.json(
    { status: ready ? "ready" : "unavailable", checks: { database, ai }, ms: Date.now() - started, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
