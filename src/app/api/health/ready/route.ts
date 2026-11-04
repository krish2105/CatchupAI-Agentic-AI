import { NextResponse } from "next/server";
import { readiness } from "@/lib/status/readiness";

export const dynamic = "force-dynamic";

/**
 * Readiness: can this deployment serve students right now? Checks the database and reports whether AI is
 * available. Liveness stays at /api/health. Reveals no hosts, versions of dependencies, or configuration values.
 */
export async function GET() {
  const started = Date.now();
  const r = await readiness();
  const ready = r.database === "ok";
  return NextResponse.json(
    { status: ready ? "ready" : "unavailable", checks: { database: r.database, ai: r.ai }, ms: Date.now() - started, version: r.version },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
