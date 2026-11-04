import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { claimNewErrorGroups } from "@/lib/observability/app-errors";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Called by the "Error alerts" GitHub Actions workflow with `Authorization: Bearer $CRON_SECRET`.
 * Returns the error groups not reported before and marks them reported; the workflow fails when the list
 * isn't empty, and GitHub emails the repository owner about the failed run. Text is already redacted.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const groups = await claimNewErrorGroups(adminClient());
  return NextResponse.json(
    { newGroups: groups.map((g) => ({ fingerprint: g.fingerprint, source: g.source, path: g.path, name: g.errorName, message: g.message, count: g.count, firstSeen: g.firstSeen, release: g.release })) },
    { headers: { "cache-control": "no-store" } },
  );
}

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
