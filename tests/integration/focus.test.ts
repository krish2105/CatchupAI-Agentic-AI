import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approveProposal, createProposal } from "@/lib/planner/service";
import { recordFocusSession } from "@/lib/db/focus";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let taskA: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("focus-a"), signedInUser("focus-b")]);
  await a.db.from("profiles").update({ timezone: "UTC", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "00:30" }).eq("id", a.id);
  const course = (await a.db.from("courses").insert({ title: "Stats" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: course, title: "Sheet", due_at: new Date(Date.now() + 4 * 86400_000).toISOString(), estimated_minutes: 60 });
  const proposal = await createProposal({ supabase: asServer(a.db), admin: admin() as unknown as AdminSupabase, userId: a.id, scenario: "essential", now: Date.now() });
  const approved = await approveProposal(asServer(a.db), proposal.id, "focus-test-key-1");
  taskA = approved.taskIds[0];
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("focus sessions", () => {
  it("records a completed session and can complete the linked block", async () => {
    const now = Date.now();
    const session = await recordFocusSession(asServer(a.db), { taskId: taskA, plannedMinutes: 25, focusedMinutes: 25, startedAt: new Date(now - 26 * 60_000).toISOString(), completed: true, markTaskDone: true }, now);
    expect(session).toMatchObject({ focusedMinutes: 25, completed: true, taskId: taskA });
    const { data } = await a.db.from("study_tasks").select("status").eq("id", taskA).single();
    expect(data?.status).toBe("completed");
  });

  it("rejects focused time longer than the session and out-of-range start times", async () => {
    const now = Date.now();
    await expect(recordFocusSession(asServer(a.db), { taskId: null, plannedMinutes: 25, focusedMinutes: 25, startedAt: new Date(now - 5 * 60_000).toISOString(), completed: true, markTaskDone: false }, now)).rejects.toMatchObject({ status: 400 });
    await expect(recordFocusSession(asServer(a.db), { taskId: null, plannedMinutes: 25, focusedMinutes: 1, startedAt: new Date(now - 7 * 3600_000).toISOString(), completed: false, markTaskDone: false }, now)).rejects.toMatchObject({ status: 400 });
    const direct = await a.db.from("focus_sessions").insert({ planned_minutes: 25, focused_minutes: 60, started_at: new Date(now - 10 * 60_000).toISOString(), ended_at: new Date(now).toISOString() });
    expect(direct.error?.code).toBe("23514");
  });

  it("cannot be linked to another student's block, spoof an owner, or be read by others", async () => {
    const now = Date.now();
    await expect(recordFocusSession(asServer(b.db), { taskId: taskA, plannedMinutes: 25, focusedMinutes: 1, startedAt: new Date(now - 2 * 60_000).toISOString(), completed: false, markTaskDone: false }, now)).rejects.toMatchObject({ status: 404 });
    const spoof = await b.db.from("focus_sessions").insert({ owner_id: a.id, planned_minutes: 25, focused_minutes: 0, started_at: new Date(now - 60_000).toISOString() } as never);
    expect(spoof.error?.code).toBe("42501");
    expect((await b.db.from("focus_sessions").select("id").eq("owner_id", a.id)).data).toEqual([]);
  });
});
