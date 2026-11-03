import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

const DEMO_TTL_HOURS = 24;

/**
 * Deletes anonymous demo accounts older than 24 hours (files first, then the auth user; rows cascade).
 * Called by the scheduler with `Authorization: Bearer $CRON_SECRET`; refuses everything else.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const admin = adminClient();
  const cutoff = Date.now() - DEMO_TTL_HOURS * 3600_000;
  let deleted = 0;
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: { code: "list_failed" } }, { status: 500 });
    for (const u of data.users) {
      if (!u.is_anonymous || Date.parse(u.created_at) > cutoff) continue;
      const { data: files } = await admin.storage.from("course-documents").list(u.id, { limit: 1000 });
      for (const folder of files ?? []) {
        const { data: inner } = await admin.storage.from("course-documents").list(`${u.id}/${folder.name}`, { limit: 1000 });
        const paths = (inner ?? []).map((f) => `${u.id}/${folder.name}/${f.name}`);
        if (paths.length) await admin.storage.from("course-documents").remove(paths);
      }
      if (!(await admin.auth.admin.deleteUser(u.id)).error) deleted++;
    }
    if (data.users.length < 200) break;
  }
  return NextResponse.json({ deleted });
}

/** Constant-time comparison so response timing doesn't reveal how much of the secret matched. */
function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
