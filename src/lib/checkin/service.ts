import "server-only";
import { z } from "zod";
import { listAssignments } from "@/lib/db/assignments";
import { ApiError, fromDbError, isMissingSchema } from "@/lib/http/errors";
import { computePlan, createProposal, PROPOSAL_COLUMNS, toProposal, type ProposalDto } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { chooseRoute, detectSlipping, type CheckinBlock } from "./detect";

/** A check-in draft stays open until shortly before the next daily run (02:30 UTC). */
export const PROACTIVE_TTL_MS = 20 * 3_600_000;
const BLOCK_COLUMNS = "assignment_id, starts_at, ends_at, duration_minutes, status";

/** Before migration 0023 reaches a database, its new columns don't exist yet: the feature is simply off. */
function isMissingColumn(error: { code?: string } | null | undefined) {
  return isMissingSchema(error) || error?.code === "42703" || error?.code === "PGRST204";
}

export const checkinPrefSchema = z.object({ enabled: z.boolean() }).strict();

/** On unless the student turned it off (no row yet means on). */
export async function getCheckinPref(supabase: ServerSupabase): Promise<boolean> {
  const { data, error } = await supabase.from("notification_prefs").select("proactive_checkin").maybeSingle();
  if (error) {
    if (isMissingColumn(error)) return true;
    throw fromDbError(error);
  }
  return data?.proactive_checkin ?? true;
}

/** owner_id comes from the column default (auth.uid()); this writes only the check-in switch. */
export async function saveCheckinPref(supabase: ServerSupabase, enabled: boolean): Promise<boolean> {
  const { error } = await supabase.from("notification_prefs").upsert({ proactive_checkin: enabled }, { onConflict: "owner_id" });
  if (error) {
    if (isMissingColumn(error)) throw new ApiError(503, "not_available", "Check-ins aren't available yet. Please try again later.");
    throw fromDbError(error);
  }
  return enabled;
}

/** The student's open check-in draft, if any (read through their own RLS client). */
export async function getProactiveDraft(supabase: ServerSupabase, now: number): Promise<{ proposal: ProposalDto; reason: string } | null> {
  const { data, error } = await supabase
    .from("action_proposals")
    .select(`${PROPOSAL_COLUMNS}, reason`)
    .eq("proactive", true)
    .eq("status", "pending")
    .gt("expires_at", new Date(now).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error)) return null;
    throw fromDbError(error);
  }
  return data ? { proposal: toProposal(data, now), reason: data.reason ?? "" } : null;
}

export type CheckinResult = { available: boolean; considered: number; drafted: number; skipped: number; failed: number };

/**
 * The daily check-in. For each student with an approved plan: skip demo accounts, students who opted out, anyone
 * with a draft already waiting and anyone checked in today; otherwise, if they are slipping, draft a re-plan with
 * the deterministic planner and record why. Runs with the service role, so every read filters by owner explicitly.
 * It never approves anything: the student approves or dismisses the draft on the dashboard.
 */
export async function runCheckins({ admin, now, ownerIds }: { admin: AdminSupabase; now: number; ownerIds?: string[] }): Promise<CheckinResult> {
  const result: CheckinResult = { available: true, considered: 0, drafted: 0, skipped: 0, failed: 0 };
  const probe = await admin.from("action_proposals").select("checkin_on").limit(1);
  if (probe.error) {
    if (isMissingColumn(probe.error)) return { ...result, available: false };
    throw fromDbError(probe.error);
  }
  let candidates = admin.from("study_plans").select("owner_id").eq("status", "active").limit(500);
  if (ownerIds) candidates = candidates.in("owner_id", ownerIds);
  const { data: plans, error } = await candidates;
  if (error) throw fromDbError(error);

  const today = new Date(now).toISOString().slice(0, 10);
  const owners = [...new Set((plans ?? []).map((p) => p.owner_id))];
  result.considered = owners.length;
  for (const ownerId of owners) {
    try {
      if (await checkIn(admin, ownerId, now, today)) result.drafted++;
      else result.skipped++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

async function checkIn(admin: AdminSupabase, ownerId: string, now: number, today: string): Promise<boolean> {
  const { data: account } = await admin.auth.admin.getUserById(ownerId);
  if (!account?.user || account.user.is_anonymous) return false;

  const nowIso = new Date(now).toISOString();
  const [prefs, waiting, checkedIn, active, completed] = await Promise.all([
    admin.from("notification_prefs").select("proactive_checkin").eq("owner_id", ownerId).maybeSingle(),
    admin.from("action_proposals").select("id").eq("owner_id", ownerId).eq("status", "pending").gt("expires_at", nowIso).limit(1),
    admin.from("action_proposals").select("id").eq("owner_id", ownerId).eq("checkin_on", today).limit(1),
    admin.from("study_tasks").select(BLOCK_COLUMNS).eq("owner_id", ownerId).eq("active", true),
    admin.from("study_tasks").select(BLOCK_COLUMNS).eq("owner_id", ownerId).eq("status", "completed"),
  ]);
  for (const r of [prefs, waiting, checkedIn, active, completed]) if (r.error) throw fromDbError(r.error);
  if (prefs.data?.proactive_checkin === false || waiting.data?.length || checkedIn.data?.length) return false;

  // Safe only because computePlan, buildCandidateItems, listAssignments and createProposal filter every read
  // and write by this owner explicitly (RLS doesn't apply to the service role).
  const scoped = admin as unknown as ServerSupabase;
  const toBlock = (t: { assignment_id: string | null; starts_at: string; ends_at: string; duration_minutes: number | null; status: string }): CheckinBlock => ({
    assignmentId: t.assignment_id,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    durationMinutes: t.duration_minutes ?? 0,
    status: t.status as CheckinBlock["status"],
  });
  const assignments = await listAssignments(scoped, { ownerId });
  const slip = detectSlipping({ now, assignments, activeTasks: (active.data ?? []).map(toBlock), completedTasks: (completed.data ?? []).map(toBlock) });
  if (!slip.slipping) return false;

  const plan = await computePlan(scoped, ownerId, { now });
  try {
    await createProposal({ supabase: scoped, admin, userId: ownerId, scenario: chooseRoute(plan), now, proactive: { reason: slip.reason, checkinOn: today }, ttlMs: PROACTIVE_TTL_MS });
  } catch (e) {
    // Already checked in today (unique per student and day), or nothing left to plan.
    if (e instanceof ApiError && (e.code === "conflict" || e.code === "nothing_to_plan")) return false;
    throw e;
  }
  return true;
}
