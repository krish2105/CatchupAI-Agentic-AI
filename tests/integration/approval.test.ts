import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approveProposal, createProposal, rejectProposal } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let courseId: string;
let assignmentId: string;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
const key = () => crypto.randomUUID().replaceAll("-", "");
const propose = (user: User, scenario: "essential" | "balanced" | "full" = "essential") =>
  createProposal({ supabase: asServer(user.db), admin: adminDb(), userId: user.id, scenario, now: Date.now() });

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e as { status: number; code: string };
  }
}

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("plan-a"), signedInUser("plan-b")]);
  await a.db.from("profiles").update({ timezone: "UTC", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "08:00" }).eq("id", a.id);
  const course = await a.db.from("courses").insert({ title: "Statistics" }).select("id").single();
  courseId = course.data!.id;
  const assignment = await a.db.from("assignments").insert({ course_id: courseId, title: "Worksheet", due_at: days(4), estimated_minutes: 180 }).select("id").single();
  assignmentId = assignment.data!.id;
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("proposals", () => {
  it("are created server-side as pending, feasible drafts with tasks before the deadline", async () => {
    const p = await propose(a);
    expect(p).toMatchObject({ status: "pending", feasible: true, scenario: "essential" });
    expect(p.payload.tasks.length).toBeGreaterThan(1);
    expect(p.payload.tasks.every((t) => Date.parse(t.endsAt) <= Date.parse(days(4)) + 1000)).toBe(true);
    const { count } = await a.db.from("study_tasks").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("only one pending proposal exists at a time", async () => {
    const first = await propose(a);
    await propose(a);
    const { data } = await a.db.from("action_proposals").select("status").eq("id", first.id).single();
    expect(data?.status).toBe("expired");
  });
});

describe("approval", () => {
  it("is idempotent across retries with any key", async () => {
    const p = await propose(a);
    const first = await approveProposal(asServer(a.db), p.id, key());
    expect(first.alreadyApplied).toBe(false);
    expect(first.taskIds).toHaveLength(p.payload.tasks.length);
    const again = await approveProposal(asServer(a.db), p.id, key());
    expect(again).toEqual({ ...first, alreadyApplied: true });
    const { data: tasks } = await a.db.from("study_tasks").select("id, ends_at, assignment_id").eq("plan_id", first.planId);
    expect(tasks).toHaveLength(p.payload.tasks.length);
  });

  it("creates exactly one plan under 10 concurrent approvals", async () => {
    const p = await propose(a);
    const results = await Promise.all(Array.from({ length: 10 }, () => approveProposal(asServer(a.db), p.id, key())));
    expect(new Set(results.map((r) => r.planId)).size).toBe(1);
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    const { data: plans } = await a.db.from("study_plans").select("id").eq("proposal_id", p.id);
    expect(plans).toHaveLength(1);
    const { count } = await a.db.from("study_tasks").select("id", { count: "exact", head: true }).eq("plan_id", results[0].planId);
    expect(count).toBe(p.payload.tasks.length);
  });

  it("supersedes the previous plan: one active plan, old unfinished tasks cancelled", async () => {
    const { data: active } = await a.db.from("study_plans").select("id").eq("status", "active");
    expect(active).toHaveLength(1);
    const { data: cancelled } = await a.db.from("study_tasks").select("status, active").eq("active", false);
    expect(cancelled!.length).toBeGreaterThan(0);
    expect(cancelled!.every((t) => t.status === "cancelled" && !t.active)).toBe(true);
  });

  it("reject persists no tasks and blocks later approval", async () => {
    const before = await a.db.from("study_tasks").select("id", { count: "exact", head: true });
    const p = await propose(a);
    expect(await rejectProposal(asServer(a.db), p.id)).toEqual({ status: "rejected" });
    expect(await rejectProposal(asServer(a.db), p.id)).toEqual({ status: "rejected" });
    expect(await errorOf(approveProposal(asServer(a.db), p.id, key()))).toMatchObject({ status: 409, code: "rejected" });
    const after = await a.db.from("study_tasks").select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });

  it("refuses expired proposals", async () => {
    const p = await propose(a);
    await admin().from("action_proposals").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", p.id);
    expect(await errorOf(approveProposal(asServer(a.db), p.id, key()))).toMatchObject({ status: 409, code: "expired" });
    const { data } = await a.db.from("action_proposals").select("status").eq("id", p.id).single();
    expect(data?.status).toBe("expired");
  });

  it("refuses stale proposals after the inputs changed", async () => {
    const p = await propose(a);
    await new Promise((r) => setTimeout(r, 20));
    await a.db.from("assignments").update({ estimated_minutes: 200 }).eq("id", assignmentId);
    expect(await errorOf(approveProposal(asServer(a.db), p.id, key()))).toMatchObject({ status: 409, code: "stale" });
  });

  it("refuses infeasible proposals", async () => {
    await a.db.from("assignments").insert({ course_id: courseId, title: "Huge project", due_at: days(2), estimated_minutes: 2000 });
    const p = await propose(a);
    expect(p.feasible).toBe(false);
    expect(p.payload.summary.shortfallMinutes).toBeGreaterThan(0);
    expect(await errorOf(approveProposal(asServer(a.db), p.id, key()))).toMatchObject({ status: 409, code: "infeasible" });
  });

  it("every draft carries a deterministic self-check, and a draft that fails it can't be approved", async () => {
    // The previous test left a 2000-minute project due in 2 days: the self-check says what doesn't fit.
    const short = await propose(a);
    expect(short.selfCheck.status).toBe("shortfall");
    expect(short.selfCheck.shortfalls).toEqual([expect.objectContaining({ title: "Huge project", minutes: expect.any(Number) })]);
    expect(short.selfCheck.summary).toMatch(/Huge project: \d+ min don't fit before its deadline/);
    await a.db.from("assignments").delete().eq("title", "Huge project");

    const p = await propose(a);
    expect(p.selfCheck).toMatchObject({ status: "pass", summary: expect.stringMatching(/^Self-check passed/) });
    // Tamper with the stored draft (only the server can write proposals; this simulates a planner bug).
    const broken = structuredClone(p.payload);
    broken.items[0].scheduledMinutes += 30;
    await admin().from("action_proposals").update({ payload: broken as never }).eq("id", p.id);
    const e = await errorOf(approveProposal(asServer(a.db), p.id, key()));
    expect(e).toMatchObject({ status: 409, code: "self_check_failed" });
    const { count } = await a.db.from("study_plans").select("id", { count: "exact", head: true }).eq("status", "active");
    const { data: still } = await a.db.from("action_proposals").select("status").eq("id", p.id).single();
    expect(still!.status).toBe("pending");
    expect(count).toBeLessThanOrEqual(1); // no new plan from the broken draft
  });

  it("another student cannot approve, reject or read the proposal", async () => {
    const { data } = await admin().from("action_proposals").select("id").eq("owner_id", a.id).limit(1).single();
    expect(await errorOf(approveProposal(asServer(b.db), data!.id, key()))).toMatchObject({ status: 404 });
    expect(await errorOf(rejectProposal(asServer(b.db), data!.id))).toMatchObject({ status: 404 });
    const direct = await b.db.rpc("approve_proposal", { p_proposal_id: data!.id, p_idempotency_key: key() });
    expect(direct.data).toEqual({ outcome: "not_found" });
    expect((await b.db.from("action_proposals").select("id").eq("id", data!.id)).data).toEqual([]);
  });

  it("anonymous callers cannot use the approval function", async () => {
    const { anon } = await import("./helpers");
    const res = await anon().rpc("approve_proposal", { p_proposal_id: crypto.randomUUID(), p_idempotency_key: key() });
    expect(res.error).not.toBeNull();
  });
});

describe("study tasks", () => {
  it("students can complete their own active tasks but not edit or cancel them", async () => {
    const { data: task } = await a.db.from("study_tasks").select("id").eq("active", true).limit(1).single();
    const done = await a.db.from("study_tasks").update({ status: "completed" }).eq("id", task!.id).select("status, completed_at").single();
    expect(done.data?.status).toBe("completed");
    expect(done.data?.completed_at).not.toBeNull();
    expect((await a.db.from("study_tasks").update({ title: "edited" } as never).eq("id", task!.id)).error?.code).toBe("42501");
    expect((await a.db.from("study_tasks").update({ status: "cancelled" }).eq("id", task!.id)).error?.code).toBe("42501");
    const other = await b.db.from("study_tasks").update({ status: "todo" }).eq("id", task!.id).select("id");
    expect(other.data).toEqual([]);
  });
});
