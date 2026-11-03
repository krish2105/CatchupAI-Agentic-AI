import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export type Notice = { id: string; kind: "approval" | "deadline" | "today"; title: string; detail: string; href: string };

/** Items that need the student's attention, computed from their own rows (RLS applies). */
export async function getNotifications(supabase: ServerSupabase, now: number): Promise<Notice[]> {
  const soon = new Date(now + 48 * 3600_000).toISOString();
  const nowIso = new Date(now).toISOString();
  const [proposals, deadlines, blocks] = await Promise.all([
    supabase.from("action_proposals").select("id, scenario, expires_at").eq("status", "pending").gt("expires_at", nowIso).order("created_at", { ascending: false }).limit(3),
    supabase.from("assignments").select("id, title, due_at, course_id").neq("status", "completed").gte("due_at", nowIso).lte("due_at", soon).order("due_at").limit(5),
    supabase.from("study_tasks").select("id").eq("active", true).eq("status", "todo").gte("starts_at", nowIso).lte("starts_at", new Date(now + 24 * 3600_000).toISOString()),
  ]);
  for (const r of [proposals, deadlines, blocks]) if (r.error) throw fromDbError(r.error);

  const notices: Notice[] = [];
  for (const p of proposals.data ?? []) {
    notices.push({ id: `p-${p.id}`, kind: "approval", title: "A recovery draft is waiting", detail: "Nothing is saved until you approve it.", href: `/recovery?proposal=${p.id}` });
  }
  for (const a of deadlines.data ?? []) {
    const hours = Math.max(1, Math.round((Date.parse(a.due_at) - now) / 3600_000));
    notices.push({ id: `a-${a.id}`, kind: "deadline", title: `${a.title} is due soon`, detail: hours < 24 ? `In about ${hours} hour${hours === 1 ? "" : "s"}` : "Within 2 days", href: `/courses/${a.course_id}` });
  }
  const count = blocks.data?.length ?? 0;
  if (count) notices.push({ id: "today", kind: "today", title: `${count} study block${count === 1 ? "" : "s"} in the next 24 hours`, detail: "Open your schedule to get ready.", href: "/planner" });
  return notices;
}
