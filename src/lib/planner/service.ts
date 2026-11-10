import "server-only";
import { selfCheckPlan, type SelfCheck } from "./self-check";
import { createHash } from "node:crypto";
import { listAssignments } from "@/lib/db/assignments";
import { getProfile } from "@/lib/db/profiles";
import type { Assignment, Profile } from "@/lib/db/types";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { getCalendarPrefs, getCalendarState } from "@/lib/calendar-prefs/service";
import { HORIZON_RULES, planScenarios, scaleWeekly, type PlanResult, type ScenarioKey, type WorkItem } from "./engine";
import { buildCalendarRules, hasPlanningRules, type LocalCalendarPrefs } from "./local-calendar";
import { applyCompletedWork } from "./progress";
import { findNextStep, type NextStep } from "./next-step";

export const PROPOSAL_TTL_MS = 6 * 60 * 60_000;
export const REVIEW_MINUTES = 30;
const DAY = 86_400_000;

type ReadyDoc = { id: string; course_id: string; filename: string };

/**
 * Candidate work for the planner, derived only from the student's records:
 * - required: incomplete required assignments (deadline = due date)
 * - recommended: one review session per indexed document in a course with upcoming required work, pointed at
 *   the page that best matches the assignment (real retrieval, not guessed), due before that assignment
 * - optional: incomplete optional assignments
 * Agent-proposed study items (M5) can be appended by the caller as `extraItems`.
 * Every read filters by `ownerId` explicitly as well as through RLS, so the daily check-in can run it with the
 * service role for one student (the course-material search then finds nothing, and review items carry no page).
 */
export async function buildCandidateItems(supabase: ServerSupabase, assignments: Assignment[], now: number, ownerId: string): Promise<WorkItem[]> {
  const open = assignments.filter((a) => a.status !== "completed");
  const required: WorkItem[] = open
    .filter((a) => a.required)
    .map((a) => ({
      id: `assignment:${a.id}`,
      kind: "assignment",
      title: a.title,
      courseId: a.courseId,
      assignmentId: a.id,
      minutes: a.estimatedMinutes,
      deadline: a.dueAt,
      tier: "required",
      rationale: "Required assignment with a fixed deadline.",
    }));
  const optional: WorkItem[] = open
    .filter((a) => !a.required)
    .map((a) => ({
      id: `assignment:${a.id}`,
      kind: "assignment",
      title: a.title,
      courseId: a.courseId,
      assignmentId: a.id,
      minutes: a.estimatedMinutes,
      deadline: a.dueAt,
      tier: "optional",
      rationale: "Marked optional by you.",
    }));

  const { data: docs, error } = await supabase.from("documents").select("id, course_id, filename").eq("owner_id", ownerId).eq("status", "ready").order("created_at");
  if (error) throw fromDbError(error);
  const recommended: WorkItem[] = [];
  const upcomingRequired = open
    .filter((a) => a.required && Date.parse(a.dueAt) > now)
    .sort((x, y) => Date.parse(x.dueAt) - Date.parse(y.dueAt));
  const seenCourses = new Set<string>();
  for (const assignment of upcomingRequired) {
    if (seenCourses.has(assignment.courseId)) continue;
    seenCourses.add(assignment.courseId);
    const courseDocs = (docs as ReadyDoc[]).filter((d) => d.course_id === assignment.courseId).slice(0, 2);
    if (!courseDocs.length) continue;
    const { data: hits } = await supabase.rpc("search_course_chunks", { p_course_id: assignment.courseId, p_query: assignment.title, p_limit: 6 });
    for (const doc of courseDocs) {
      const hit = (hits ?? []).find((h) => h.document_id === doc.id);
      recommended.push({
        id: `review:${doc.id}`,
        kind: "study",
        title: hit ? `Review ${doc.filename}, p. ${hit.page_start}` : `Review ${doc.filename}`,
        courseId: assignment.courseId,
        assignmentId: null,
        minutes: REVIEW_MINUTES,
        deadline: assignment.dueAt,
        tier: "recommended",
        evidence: hit ? [{ documentId: doc.id, page: hit.page_start, filename: doc.filename }] : [],
        rationale: hit
          ? `Best-matching page for “${assignment.title}” in your notes.`
          : `Course notes for the course of “${assignment.title}”.`,
      });
    }
  }
  // Completed study blocks (from any plan, current or superseded) count toward their assignment.
  const { data: done, error: doneError } = await supabase.from("study_tasks").select("assignment_id, duration_minutes").eq("owner_id", ownerId).eq("status", "completed").not("assignment_id", "is", null);
  if (doneError) throw fromDbError(doneError);
  return applyCompletedWork(
    [...required, ...recommended, ...optional],
    done.map((t) => ({ assignmentId: t.assignment_id, durationMinutes: t.duration_minutes ?? 0 })),
  );
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function inputHash(profile: Profile, assignments: Assignment[], items: WorkItem[], calendar?: LocalCalendarPrefs) {
  return sha256({
    availability: { timezone: profile.timezone, weeklyMinutes: profile.weeklyMinutes, studyStartTime: profile.studyStartTime },
    assignments: assignments.map((a) => [a.id, a.dueAt, a.estimatedMinutes, a.required, a.status, a.updatedAt]).sort(),
    items: items.map((i) => [i.id, i.minutes, i.deadline, i.tier]),
    // Only planning rules count (showing Hijri dates doesn't); without them the hash is the same as before.
    ...(calendar && hasPlanningRules(calendar) ? { calendar: { ...calendar, showHijri: undefined } } : {}),
  });
}

export type ComputedPlan = PlanResult & { inputHash: string; timezone: string; weeklyMinutes: number[]; whatIf: boolean; nextStep: NextStep | null };

/** Computes the three scenarios for the signed-in student. `weeklyTotal` is a what-if override (never saved). */
export async function computePlan(
  supabase: ServerSupabase,
  userId: string,
  opts: { now: number; weeklyTotal?: number; extraItems?: WorkItem[] },
): Promise<ComputedPlan> {
  const [profile, assignments, localCalendar] = await Promise.all([getProfile(supabase, userId), listAssignments(supabase, { ownerId: userId }), getCalendarPrefs(supabase, userId)]);
  const candidates = await buildCandidateItems(supabase, assignments, opts.now, userId);
  // Copilot-proposed (cited) study items rank ahead of the planner's generic review sessions.
  const items = [...candidates.filter((i) => i.tier === "required"), ...(opts.extraItems ?? []), ...candidates.filter((i) => i.tier !== "required")];
  const savedTotal = profile.weeklyMinutes.reduce((s, m) => s + m, 0);
  const whatIf = opts.weeklyTotal !== undefined && opts.weeklyTotal !== savedTotal;
  const weeklyMinutes = whatIf ? scaleWeekly(profile.weeklyMinutes, opts.weeklyTotal!) : profile.weeklyMinutes;
  // Local calendar rules (Friday prayer, prayer-time breaks, Ramadan) for every day the horizon can reach.
  const calendar = buildCalendarRules(localCalendar, profile.timezone, opts.now - DAY, opts.now + (HORIZON_RULES.maxDays + 2) * DAY);
  const availability = { timezone: profile.timezone, weeklyMinutes, studyStartTime: profile.studyStartTime, ...(calendar ? { calendar } : {}) };
  const plan = planScenarios({ items, availability, now: opts.now });
  // When every route is short: why, and the smallest change that fixes it (deterministic; see next-step.ts).
  const nextStep = findNextStep({ items, availability, now: opts.now, plan });
  return { ...plan, inputHash: inputHash(profile, assignments, items, localCalendar), timezone: profile.timezone, weeklyMinutes, whatIf, nextStep };
}

export type ProposalDto = {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  scenario: ScenarioKey;
  feasible: boolean;
  expiresAt: string;
  createdAt: string;
  runId: string | null;
  appliedPlanId: string | null;
  decidedAt: string | null;
  payload: ProposalPayload;
  /** Deterministic re-check of the stored draft (see self-check.ts); computed on every read, never stored. */
  selfCheck: SelfCheck;
};

export type ProposalPayload = {
  title: string;
  summary: { requiredMinutes: number; scheduledMinutes: number; shortfallMinutes: number; availableMinutes: number; coveragePercent: number; horizon: PlanResult["horizon"] };
  items: PlanResult["scenarios"][number]["items"];
  tasks: PlanResult["scenarios"][number]["tasks"];
  overdue: PlanResult["overdue"];
};

type ProposalRow = {
  id: string;
  status: string;
  scenario: string;
  feasible: boolean;
  expires_at: string;
  created_at: string;
  run_id: string | null;
  applied_plan_id: string | null;
  decided_at: string | null;
  payload: Json;
};

export function toProposal(row: ProposalRow, now: number): ProposalDto {
  const status = row.status === "pending" && Date.parse(row.expires_at) <= now ? "expired" : (row.status as ProposalDto["status"]);
  return {
    id: row.id,
    status,
    scenario: row.scenario as ScenarioKey,
    feasible: row.feasible,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    runId: row.run_id,
    appliedPlanId: row.applied_plan_id,
    decidedAt: row.decided_at,
    payload: row.payload as unknown as ProposalPayload,
    selfCheck: selfCheckPlan(row.payload as unknown as ProposalPayload),
  };
}

export const PROPOSAL_COLUMNS = "id, status, scenario, feasible, expires_at, created_at, decided_at, run_id, applied_plan_id, payload";

/**
 * Creates a pending proposal from a server-side recomputation with the SAVED availability (never a what-if).
 * Written with the admin client because students cannot insert proposals; owner comes from the verified session.
 */
export async function createProposal(deps: {
  supabase: ServerSupabase;
  admin: AdminSupabase;
  userId: string;
  scenario: ScenarioKey;
  now: number;
  runId?: string | null;
  extraItems?: WorkItem[];
  /** Set by the daily check-in: why it drafted this, and the day it ran (at most one per student per day). */
  proactive?: { reason: string; checkinOn: string };
  ttlMs?: number;
}): Promise<ProposalDto> {
  const plan = await computePlan(deps.supabase, deps.userId, { now: deps.now, extraItems: deps.extraItems });
  const chosen = plan.scenarios.find((s) => s.key === deps.scenario)!;
  if (chosen.requiredMinutes === 0) throw new ApiError(409, "nothing_to_plan", "There is no upcoming work to plan.");
  const payload: ProposalPayload = {
    title: `${chosen.title} · ${new Date(deps.now).toISOString().slice(0, 10)}`,
    summary: {
      requiredMinutes: chosen.requiredMinutes,
      scheduledMinutes: chosen.scheduledMinutes,
      shortfallMinutes: chosen.shortfallMinutes,
      availableMinutes: chosen.availableMinutes,
      coveragePercent: chosen.coveragePercent,
      horizon: plan.horizon,
    },
    items: chosen.items,
    tasks: chosen.tasks,
    overdue: plan.overdue,
  };
  const { data, error } = await deps.admin
    .from("action_proposals")
    .insert({
      owner_id: deps.userId,
      run_id: deps.runId ?? null,
      scenario: deps.scenario,
      payload: payload as unknown as Json,
      payload_hash: sha256(payload),
      input_hash: plan.inputHash,
      feasible: chosen.feasible,
      expires_at: new Date(deps.now + (deps.ttlMs ?? PROPOSAL_TTL_MS)).toISOString(),
      ...(deps.proactive ? { proactive: true, reason: deps.proactive.reason.slice(0, 500), checkin_on: deps.proactive.checkinOn } : {}),
    })
    .select(PROPOSAL_COLUMNS)
    .single();
  if (error) throw fromDbError(error);
  // One pending proposal at a time: older pending drafts expire (after the insert, so a failed insert keeps them).
  await deps.admin.from("action_proposals").update({ status: "expired", decided_at: new Date(deps.now).toISOString() }).eq("owner_id", deps.userId).eq("status", "pending").neq("id", data.id);
  return toProposal(data, deps.now);
}

export async function getProposal(supabase: ServerSupabase, id: string, now: number): Promise<ProposalDto> {
  const { data, error } = await supabase.from("action_proposals").select(PROPOSAL_COLUMNS).eq("id", id).single();
  if (error) throw fromDbError(error, "Proposal not found.");
  return toProposal(data, now);
}

const OUTCOME_ERRORS: Record<string, ApiError> = {
  not_found: new ApiError(404, "not_found", "Proposal not found."),
  expired: new ApiError(409, "expired", "This proposal has expired. Compare the routes again to get a fresh plan."),
  stale: new ApiError(409, "stale", "Your assignments or availability changed since this plan was made. Recompute the routes to get an up-to-date plan."),
  infeasible: new ApiError(409, "infeasible", "This route doesn't fit your available time, so it can't be approved."),
  rejected: new ApiError(409, "rejected", "This proposal was already rejected."),
};

export async function approveProposal(supabase: ServerSupabase, id: string, idempotencyKey: string) {
  // Defense in depth on top of the database's own deadline and overlap guards: re-check the stored draft.
  const { data: stored } = await supabase.from("action_proposals").select("payload, status, created_at").eq("id", id).maybeSingle();
  if (stored && selfCheckPlan(stored.payload as unknown as ProposalPayload).status === "fail") {
    throw new ApiError(409, "self_check_failed", "This draft failed its self-check (blocks overlap, run past a deadline or don't add up), so it can't be approved. Compare the routes again for a fresh plan.");
  }
  // The database refuses drafts made before the profile or assignments changed; local calendar rules live in
  // their own table, so a pending draft made before one of those rules changed is refused here the same way.
  if (stored?.status === "pending") {
    const { rulesChangedAt } = await getCalendarState(supabase);
    if (rulesChangedAt && Date.parse(rulesChangedAt) > Date.parse(stored.created_at)) throw OUTCOME_ERRORS.stale;
  }
  const { data, error } = await supabase.rpc("approve_proposal", { p_proposal_id: id, p_idempotency_key: idempotencyKey });
  if (error) {
    if (error.code === "23P01" || error.code === "23505") throw new ApiError(409, "conflict", "Another plan was approved at the same time. Reload and try again.");
    throw fromDbError(error, "Proposal not found.");
  }
  const result = data as { outcome: string; planId?: string; taskIds?: string[]; alreadyApplied?: boolean };
  if (result.outcome !== "approved") throw OUTCOME_ERRORS[result.outcome] ?? new ApiError(409, "conflict", "This proposal can no longer be approved.");
  return { planId: result.planId!, taskIds: result.taskIds ?? [], alreadyApplied: Boolean(result.alreadyApplied) };
}

export async function rejectProposal(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.rpc("reject_proposal", { p_proposal_id: id });
  if (error) throw fromDbError(error, "Proposal not found.");
  const outcome = (data as { outcome: string }).outcome;
  if (outcome === "rejected") return { status: "rejected" as const };
  if (outcome === "approved") throw new ApiError(409, "already_approved", "This plan was already approved.");
  throw OUTCOME_ERRORS[outcome] ?? new ApiError(409, "conflict", "This proposal can't be rejected.");
}
