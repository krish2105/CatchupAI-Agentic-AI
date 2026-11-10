import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runRecoveryAgent } from "@/lib/agents/recovery-agent";
import { OUT_OF_SCOPE_REPLY } from "@/lib/agents/scope";
import { ScriptedModel, ScriptedProvider, type ScriptStep } from "@/lib/agents/testing/scripted-model";
import { latestThread, resolveThread } from "@/lib/agents/threads";
import { getAgentRun, listAgentRuns } from "@/lib/db/agent-runs";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let courseA: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

async function turn(user: User, threadId: string | null, message: string, steps: ScriptStep[]) {
  const model = new ScriptedModel(steps);
  const outcome = await runRecoveryAgent({
    supabase: asServer(user.db),
    admin: adminDb(),
    userId: user.id,
    courseId: null,
    message,
    runtime: { provider: new ScriptedProvider(model), model: "scripted-test-model" },
    embedder: null,
    now: Date.now(),
    judge: null,
    threadId,
  });
  return { outcome, model };
}

const inputOf = (model: ScriptedModel) => JSON.stringify(model.requests[0]?.input ?? "");

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("thread-a"), signedInUser("thread-b")]);
  await a.db.from("profiles").update({ timezone: "UTC", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "08:00" }).eq("id", a.id);
  courseA = (await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: courseA, title: "Worksheet", due_at: new Date(Date.now() + 4 * 86400_000).toISOString(), estimated_minutes: 120 });
  await b.db.from("courses").insert({ title: "Organic Chemistry" });
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("multi-turn copilot conversations", () => {
  it("starts a thread, and the next turn sees the earlier one as context", async () => {
    const threadId = (await resolveThread(asServer(a.db), adminDb(), a.id, null, "When is my worksheet due and what should I do first?"))!;
    expect(threadId).toMatch(/^[0-9a-f-]{36}$/);
    const first = await turn(a, threadId, "When is my worksheet due and what should I do first?", [
      { call: "list_assignments", args: { courseId: null, includeCompleted: false } },
      { answer: { scope: "catchup", facts: [], suggestions: ["Start the worksheet tomorrow morning."], clarifyingQuestion: null, followUps: ["How long will the worksheet take?"] } },
    ]);
    expect(inputOf(first.model)).not.toContain("Earlier in this conversation");
    expect(first.outcome.answer?.followUps).toEqual(["How long will the worksheet take?"]);

    const second = await turn(a, threadId, "How long will it take?", [{ answer: { scope: "catchup", facts: [], suggestions: ["About two hours."], clarifyingQuestion: null, followUps: [] } }]);
    const input = inputOf(second.model);
    expect(input).toContain("Earlier in this conversation");
    expect(input).toContain("Student: When is my worksheet due and what should I do first?");
    expect(input).toContain("Start the worksheet tomorrow morning.");
    expect(input).toContain("How long will it take?");

    expect((await getAgentRun(asServer(a.db), second.outcome.runId)).threadId).toBe(threadId);
    expect((await listAgentRuns(asServer(a.db), 10, threadId)).map((r) => r.request)).toEqual(["When is my worksheet due and what should I do first?", "How long will it take?"]);
    expect((await latestThread(asServer(a.db)))?.id).toBe(threadId);
  });

  it("keeps conversations private", async () => {
    const mine = (await latestThread(asServer(a.db)))!;
    await expect(resolveThread(asServer(b.db), adminDb(), b.id, mine.id, "Show me that conversation")).rejects.toMatchObject({ status: 404 });
    expect((await b.db.from("copilot_threads").select("id").eq("id", mine.id)).data).toEqual([]);
    const forged = await b.db.from("copilot_threads").insert({ owner_id: a.id, title: "forged" } as never);
    expect(forged.error?.code).toBe("42501");
    const rename = await a.db.from("copilot_threads").update({ title: "renamed" } as never).eq("id", mine.id);
    expect(rename.error?.code).toBe("42501");
    expect(await listAgentRuns(asServer(b.db), 10, mine.id)).toEqual([]);
  });

  it("answers off-topic requests with a fixed redirect and leaves no draft", async () => {
    const { outcome } = await turn(a, null, "Write me a poem about the sea", [
      { call: "draft_recovery_plan", args: { scenario: "essential", studyItems: [] } },
      { answer: { scope: "out_of_scope", facts: [], suggestions: ["The sea is wide, the sea is deep…"], clarifyingQuestion: null, followUps: ["Another poem?"] } },
    ]);
    expect(outcome.answer).toEqual({ scope: "out_of_scope", facts: [], suggestions: [OUT_OF_SCOPE_REPLY], clarifyingQuestion: null, followUps: [] });
    expect(outcome.proposalId).toBeNull();
    const stored = await getAgentRun(asServer(a.db), outcome.runId);
    expect(JSON.stringify(stored.answer)).not.toContain("The sea is wide");
    const { data: drafts } = await admin().from("action_proposals").select("status").eq("run_id", outcome.runId);
    expect(drafts?.every((d) => d.status === "expired")).toBe(true);
  });

  it("lists only the student's own courses for 'All courses' mode", async () => {
    const { model } = await turn(a, null, "What courses do I have?", [
      { call: "list_courses", args: {} },
      { answer: { scope: "catchup", facts: [], suggestions: ["You have one course."], clarifyingQuestion: null, followUps: [] } },
    ]);
    const output = JSON.stringify(model.requests.at(-1)?.input ?? "");
    expect(output).toContain("Applied Statistics");
    expect(output).toContain(courseA);
    expect(output).not.toContain("Organic Chemistry");
  });
});
