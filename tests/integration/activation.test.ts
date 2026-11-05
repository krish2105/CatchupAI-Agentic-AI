import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activationFunnel, getActivationFacts } from "@/lib/activation/service";
import { approveProposal, createProposal } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; db: Db };
let active: User;
let newbie: User;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

beforeAll(async () => {
  [active, newbie] = await Promise.all([signedInUser("act-a"), signedInUser("act-b")]);
  await active.db.from("profiles").update({ timezone: "UTC", weekly_minutes: [180, 180, 180, 180, 180, 180, 180], study_start_time: "00:00" }).eq("id", active.id);
  const course = (await active.db.from("courses").insert({ title: "Statistics" }).select("id").single()).data!.id;
  await active.db.from("assignments").insert({ course_id: course, title: "Worksheet", due_at: new Date(Date.now() + 5 * 86400_000).toISOString(), estimated_minutes: 60 });
  const proposal = await createProposal({ supabase: asServer(active.db), admin: adminDb(), userId: active.id, scenario: "essential", now: Date.now() });
  await approveProposal(asServer(active.db), proposal.id, `act-${crypto.randomUUID()}`);
  const { data: task } = await active.db.from("study_tasks").select("id").limit(1).single();
  await active.db.from("study_tasks").update({ status: "completed" }).eq("id", task!.id);
  await newbie.db.from("courses").insert({ title: "History" });
});

afterAll(async () => {
  await Promise.all([active && deleteUser(active.id), newbie && deleteUser(newbie.id)]);
});

describe("activation", () => {
  it("reads a student's own progress from their rows (RLS)", async () => {
    expect(await getActivationFacts(asServer(active.db))).toMatchObject({ courses: 1, assignments: 1, approvedPlans: 1, completedBlocks: 1, readyDocuments: 0, copilotRuns: 0, quizAttempts: 0 });
    expect(await getActivationFacts(asServer(newbie.db))).toMatchObject({ courses: 1, assignments: 0, approvedPlans: 0 });
  });

  it("the owner's funnel counts accounts per step and the activation rate, with time to the first approved plan", async () => {
    const f = await activationFunnel(adminDb(), { since: new Date(Date.now() - 86400_000).toISOString(), userIds: [active.id, newbie.id] });
    expect(f.signups).toBe(2);
    expect(Object.fromEntries(f.steps.map((s) => [s.id, s.accounts]))).toMatchObject({ course: 2, deadline: 1, plan: 1, block: 1, notes: 0, copilot: 0, check: 0 });
    expect(f.activated).toBe(1);
    expect(f.activationRate).toBe(50);
    expect(f.medianMinutesToFirstPlan).not.toBeNull();
    expect(f.medianMinutesToFirstPlan!).toBeGreaterThanOrEqual(0);
  });
});
