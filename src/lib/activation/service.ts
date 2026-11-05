import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { ACTIVATION_STEPS, median, type ActivationFacts } from "./steps";

/** The student's own counts for the getting-started checklist (head-only counts under their RLS scope). */
export async function getActivationFacts(supabase: ServerSupabase): Promise<ActivationFacts> {
  const count = async (q: PromiseLike<{ count: number | null; error: { code?: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw fromDbError(error);
    return n ?? 0;
  };
  const head = { count: "exact" as const, head: true };
  const [courses, readyDocuments, assignments, approvedPlans, completedBlocks, copilotRuns, quizAttempts] = await Promise.all([
    count(supabase.from("courses").select("id", head)),
    count(supabase.from("documents").select("id", head).eq("status", "ready")),
    count(supabase.from("assignments").select("id", head)),
    count(supabase.from("study_plans").select("id", head)),
    count(supabase.from("study_tasks").select("id", head).eq("status", "completed")),
    count(supabase.from("agent_runs").select("id", head).eq("status", "completed")),
    count(supabase.from("quiz_attempts").select("id", head)),
  ]);
  return { courses, readyDocuments, assignments, approvedPlans, completedBlocks, copilotRuns, quizAttempts };
}

type StepQuery = { table: string; filter?: [string, string] };
const STEP_SOURCES: Record<(typeof ACTIVATION_STEPS)[number]["id"], StepQuery> = {
  course: { table: "courses" },
  deadline: { table: "assignments" },
  notes: { table: "documents", filter: ["status", "ready"] },
  copilot: { table: "agent_runs", filter: ["status", "completed"] },
  plan: { table: "study_plans" },
  block: { table: "study_tasks", filter: ["status", "completed"] },
  check: { table: "quiz_attempts" },
};

export type ActivationFunnel = {
  since: string;
  signups: number;
  steps: { id: string; title: string; accounts: number }[];
  activated: number;
  activationRate: number | null;
  medianMinutesToFirstPlan: number | null;
};

/**
 * Owner-only funnel over full (non-demo) accounts created since a date: how many reached each step, how many
 * activated (approved plan + finished block), and the median time from sign-up to the first approved plan.
 * Derived from existing rows with the service role; no analytics events or third-party tracking.
 */
export async function activationFunnel(admin: AdminSupabase, opts: { since: string; userIds?: string[] }): Promise<ActivationFunnel> {
  const users: { id: string; created_at: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.filter((u) => !u.is_anonymous && u.created_at >= opts.since && (!opts.userIds || opts.userIds.includes(u.id))).map((u) => ({ id: u.id, created_at: u.created_at })));
    if (data.users.length < 1000) break;
  }
  const ids = users.map((u) => u.id);
  const generic = admin as unknown as { from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => { eq: (c: string, v: string) => PromiseLike<{ data: { owner_id: string; created_at?: string }[] | null; error: { code?: string } | null }> } & PromiseLike<{ data: { owner_id: string; created_at?: string }[] | null; error: { code?: string } | null }> } } };
  const owners = new Map<string, Set<string>>();
  const firstPlan = new Map<string, string>();
  for (const step of ACTIVATION_STEPS) {
    const src = STEP_SOURCES[step.id];
    const set = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const base = generic.from(src.table).select(step.id === "plan" ? "owner_id, created_at" : "owner_id").in("owner_id", chunk);
      const { data, error } = await (src.filter ? base.eq(src.filter[0], src.filter[1]) : base);
      if (error) throw fromDbError(error);
      for (const r of data ?? []) {
        set.add(r.owner_id);
        if (step.id === "plan" && r.created_at && (!firstPlan.has(r.owner_id) || r.created_at < firstPlan.get(r.owner_id)!)) firstPlan.set(r.owner_id, r.created_at);
      }
    }
    owners.set(step.id, set);
  }
  const activated = ids.filter((id) => owners.get("plan")!.has(id) && owners.get("block")!.has(id)).length;
  const created = new Map(users.map((u) => [u.id, Date.parse(u.created_at)]));
  const minutes = [...firstPlan.entries()].map(([id, at]) => Math.max(0, Math.round((Date.parse(at) - created.get(id)!) / 60_000)));
  return {
    since: opts.since,
    signups: ids.length,
    steps: ACTIVATION_STEPS.map((s) => ({ id: s.id, title: s.title, accounts: owners.get(s.id)!.size })),
    activated,
    activationRate: ids.length ? Math.round((activated / ids.length) * 100) : null,
    medianMinutesToFirstPlan: median(minutes),
  };
}
