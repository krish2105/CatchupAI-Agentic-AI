import "server-only";
import { z } from "zod";
import { fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { buildDigest } from "./digest";
import { unsubscribeSignature } from "./sign";

export const nudgePrefsSchema = z.object({ dailyDigest: z.boolean(), missedAlert: z.boolean() }).strict();
export type NudgePrefs = z.infer<typeof nudgePrefsSchema>;

export async function getNudgePrefs(supabase: ServerSupabase): Promise<NudgePrefs> {
  const { data, error } = await supabase.from("notification_prefs").select("daily_digest, missed_alert").maybeSingle();
  if (error) throw fromDbError(error);
  return { dailyDigest: data?.daily_digest ?? false, missedAlert: data?.missed_alert ?? false };
}

/** owner_id comes from the column default (auth.uid()); students can only write the two switches. */
export async function saveNudgePrefs(supabase: ServerSupabase, prefs: NudgePrefs): Promise<NudgePrefs> {
  const { error } = await supabase.from("notification_prefs").upsert({ daily_digest: prefs.dailyDigest, missed_alert: prefs.missedAlert }, { onConflict: "owner_id" });
  if (error) throw fromDbError(error);
  return prefs;
}

export type Mail = { to: string; subject: string; text: string; html: string; unsubscribeUrl: string };

/**
 * The daily nudge run: for each student who opted in, at most one email per day, built only from their own
 * rows (explicit owner_id filters, since this runs with the admin client). Anonymous demo accounts and
 * students with nothing to say are skipped.
 */
export async function sendDueNudges({ admin, now, appUrl, send }: { admin: AdminSupabase; now: number; appUrl: string; send: (mail: Mail) => Promise<void> }) {
  const today = new Date(now).toISOString().slice(0, 10);
  const nowIso = new Date(now).toISOString();
  const { data: prefs, error } = await admin
    .from("notification_prefs")
    .select("owner_id, daily_digest, missed_alert, last_sent_on")
    .or("daily_digest.eq.true,missed_alert.eq.true")
    .limit(500);
  if (error) throw fromDbError(error);

  const result = { considered: prefs?.length ?? 0, sent: 0, skipped: 0, failed: 0 };
  for (const p of prefs ?? []) {
    if (p.last_sent_on === today) { result.skipped++; continue; }
    const { data: account } = await admin.auth.admin.getUserById(p.owner_id);
    const email = account?.user?.email;
    if (!email || account?.user?.is_anonymous) { result.skipped++; continue; }

    const [profile, blocks, missed, deadlines] = await Promise.all([
      admin.from("profiles").select("display_name, timezone").eq("id", p.owner_id).maybeSingle(),
      admin.from("study_tasks").select("title, starts_at, duration_minutes, ends_at").eq("owner_id", p.owner_id).eq("active", true).eq("status", "todo")
        .gte("starts_at", nowIso).lte("starts_at", new Date(now + 24 * 3600_000).toISOString()).order("starts_at").limit(6),
      admin.from("study_tasks").select("title, starts_at, ends_at").eq("owner_id", p.owner_id).eq("active", true).eq("status", "todo")
        .lte("ends_at", nowIso).gte("ends_at", new Date(now - 48 * 3600_000).toISOString()).limit(20),
      admin.from("assignments").select("title, due_at").eq("owner_id", p.owner_id).neq("status", "completed")
        .gte("due_at", nowIso).lte("due_at", new Date(now + 72 * 3600_000).toISOString()).order("due_at").limit(4),
    ]);
    if (profile.error || blocks.error || missed.error || deadlines.error) { result.failed++; continue; }

    const minutes = (t: { starts_at: string; ends_at: string }) => Math.round((Date.parse(t.ends_at) - Date.parse(t.starts_at)) / 60_000);
    const unsubscribeUrl = `${appUrl}/api/nudges/unsubscribe?u=${p.owner_id}&s=${unsubscribeSignature(p.owner_id)}`;
    const mail = buildDigest({
      name: profile.data?.display_name?.trim() || "there",
      timezone: profile.data?.timezone || "UTC",
      today: (blocks.data ?? []).map((t) => ({ title: t.title, startsAt: t.starts_at, minutes: t.duration_minutes ?? minutes(t) })),
      missed: (missed.data ?? []).map((t) => ({ title: t.title, minutes: minutes(t) })),
      deadlines: (deadlines.data ?? []).map((a) => ({ title: a.title, dueAt: a.due_at })),
      appUrl,
      unsubscribeUrl,
      wantsDigest: p.daily_digest,
      wantsMissed: p.missed_alert,
    });
    if (!mail) { result.skipped++; continue; }
    try {
      await send({ to: email, unsubscribeUrl, ...mail });
      await admin.from("notification_prefs").update({ last_sent_on: today }).eq("owner_id", p.owner_id);
      result.sent++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/** One-click unsubscribe (link already verified by the caller): turns both nudges off. */
export async function unsubscribe(admin: AdminSupabase, userId: string) {
  const { error } = await admin.from("notification_prefs").update({ daily_digest: false, missed_alert: false }).eq("owner_id", userId);
  if (error) throw fromDbError(error);
}
