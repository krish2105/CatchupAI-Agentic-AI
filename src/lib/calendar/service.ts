import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { buildIcs, type CalendarEvent } from "./ics";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Builds the student's calendar: blocks of the active plan and upcoming deadlines. Always filters by owner,
 * so it is safe with the admin client (feed links) as well as the student's own client (download).
 */
export async function calendarFor(db: ServerSupabase | AdminSupabase, ownerId: string, now: number) {
  const since = new Date(now - 14 * 86400_000).toISOString();
  const [tasks, deadlines] = await Promise.all([
    db.from("study_tasks").select("id, title, kind, starts_at, ends_at, status").eq("owner_id", ownerId).eq("active", true).neq("status", "cancelled").gte("ends_at", since).order("starts_at").limit(500),
    db.from("assignments").select("id, title, due_at").eq("owner_id", ownerId).neq("status", "completed").gte("due_at", since).order("due_at").limit(200),
  ]);
  if (tasks.error) throw fromDbError(tasks.error);
  if (deadlines.error) throw fromDbError(deadlines.error);
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const events: CalendarEvent[] = [
    ...tasks.data.map((t) => ({
      uid: `task-${t.id}@catchup.ai`,
      start: t.starts_at,
      end: t.ends_at,
      title: `${t.status === "completed" ? "✓ " : ""}${t.title}`,
      description: "Study block from your approved CatchUp AI plan.",
      url: app ? `${app}/planner` : undefined,
    })),
    ...deadlines.data.map((a) => ({
      uid: `due-${a.id}@catchup.ai`,
      start: new Date(Date.parse(a.due_at) - 15 * 60_000).toISOString(),
      end: a.due_at,
      title: `Due: ${a.title}`,
      description: "Assignment deadline.",
    })),
  ];
  return buildIcs(events, { name: "CatchUp AI study plan", now });
}

/** Creates (or replaces) the student's private feed link. The token is returned once and never stored. */
export async function rotateFeed(admin: AdminSupabase, ownerId: string) {
  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("calendar_feeds").upsert({ owner_id: ownerId, token_hash: hashToken(token), created_at: new Date().toISOString() });
  if (error) throw fromDbError(error);
  return token;
}

export async function ownerForToken(admin: AdminSupabase, token: string): Promise<string | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const { data } = await admin.from("calendar_feeds").select("owner_id").eq("token_hash", hashToken(token)).maybeSingle();
  return data?.owner_id ?? null;
}
