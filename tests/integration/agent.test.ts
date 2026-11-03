import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runRecoveryAgent } from "@/lib/agents/recovery-agent";
import { ScriptedModel, ScriptedProvider, type ScriptStep } from "@/lib/agents/testing/scripted-model";
import { RECOVERY_TOOLS } from "@/lib/agents/tools";
import { processDocument } from "@/lib/rag/ingest";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fakeEmbedder } from "./fake-embedder";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let courseA: string;
let courseB: string;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

async function uploadAndIngest(user: User, courseId: string, fixture: string, filename: string) {
  const bytes = new Uint8Array(readFileSync(`tests/fixtures/${fixture}`));
  const doc = await user.db.from("documents").insert({ course_id: courseId, filename, size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await user.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(user.db), admin: adminDb(), userId: user.id, documentId: doc.data!.id, embedder: fakeEmbedder });
}

function agentRun(user: User, steps: ScriptStep[], opts: { loop?: boolean; courseId?: string | null; message?: string } = {}) {
  const model = new ScriptedModel(steps, opts.loop);
  return {
    model,
    run: runRecoveryAgent({
      supabase: asServer(user.db),
      admin: adminDb(),
      userId: user.id,
      courseId: opts.courseId ?? null,
      message: opts.message ?? "I missed Module 4 and my worksheet is due soon. What should I do?",
      runtime: { provider: new ScriptedProvider(model), model: "scripted-test-model" },
      embedder: fakeEmbedder,
      now: Date.now(),
    }),
  };
}

const answer = (facts: { statement: string; sourceIds: string[] }[] = [], suggestions: string[] = ["Start with the worksheet."]) => ({
  facts,
  suggestions,
  clarifyingQuestion: null,
});

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("agent-a"), signedInUser("agent-b")]);
  await a.db.from("profiles").update({ timezone: "UTC", weekly_minutes: [150, 150, 150, 150, 150, 150, 150], study_start_time: "00:30" }).eq("id", a.id);
  courseA = (await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  courseB = (await b.db.from("courses").insert({ title: "B private course" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: courseA, title: "Regression worksheet", due_at: days(5), estimated_minutes: 180 });
  await uploadAndIngest(a, courseA, "statistics_module_4.pdf", "module4.pdf");
  await uploadAndIngest(a, courseA, "injection.pdf", "sampling.pdf");
  await uploadAndIngest(b, courseB, "statistics_module_4.pdf", "b-secret.pdf");
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("LearningRecoveryAgent", () => {
  it("exposes exactly seven tools, none of which can commit, delete or approve (memories are only suggested)", () => {
    expect(RECOVERY_TOOLS.map((t) => t.name).sort()).toEqual(["draft_recovery_plan", "get_learning_progress", "get_student_memory", "get_study_preferences", "list_assignments", "search_course_material", "suggest_memory"]);
  });

  it("runs real tools, cites only retrieved pages, drafts a pending proposal and persists the trace", async () => {
    const { run, model } = agentRun(a, [
      { call: "get_study_preferences", args: {} },
      { call: "list_assignments", args: { courseId: null, includeCompleted: false } },
      { call: "search_course_material", args: { courseId: courseA, query: "What does a residual mean?", topK: 4 } },
      { call: "draft_recovery_plan", args: { scenario: "essential", studyItems: [{ title: "Review residuals", courseId: courseA, minutes: 30, sourceIds: ["S1"] }] } },
      {
        answer: answer([
          { statement: "A residual is observed Y minus predicted Y-hat.", sourceIds: ["S1"] },
          { statement: "Invented fact citing a source that was never retrieved.", sourceIds: ["S9"] },
        ]),
      },
    ]);
    const outcome = await run;
    expect(outcome.status).toBe("completed");
    expect(outcome.events.map((e) => [e.tool, e.status])).toEqual([
      ["get_study_preferences", "completed"],
      ["list_assignments", "completed"],
      ["search_course_material", "completed"],
      ["draft_recovery_plan", "completed"],
    ]);
    expect(outcome.removedUnsupportedFacts).toBe(1);
    expect(outcome.answer!.facts).toHaveLength(1);
    expect(outcome.citations).toHaveLength(1);
    expect(outcome.citations[0]).toMatchObject({ sourceId: "S1", filename: "module4.pdf", pageStart: 2 });

    // The model saw retrieved text wrapped as untrusted data.
    expect(model.requests[3].input).toBeDefined();
    const searchOutput = JSON.stringify(model.requests[3].input);
    expect(searchOutput).toContain("UNTRUSTED COURSE MATERIAL");

    const { data: proposal } = await a.db.from("action_proposals").select("status, run_id, payload").eq("id", outcome.proposalId!).single();
    expect(proposal).toMatchObject({ status: "pending", run_id: outcome.runId });
    const tasks = (proposal!.payload as { tasks: { title: string; evidence: { page: number }[] }[] }).tasks;
    expect(tasks.find((t) => t.title.startsWith("Review residuals"))?.evidence[0].page).toBe(2);
    const { count } = await a.db.from("study_tasks").select("id", { count: "exact", head: true });
    expect(count).toBe(0);

    const { data: stored } = await a.db.from("agent_runs").select("status, tool_events, citations, input_tokens").eq("id", outcome.runId).single();
    expect(stored!.status).toBe("completed");
    expect(stored!.tool_events).toHaveLength(4);
    expect(stored!.citations).toEqual([expect.objectContaining({ sourceId: "S1", page: 2, filename: "module4.pdf" })]);
    expect(stored!.input_tokens).toBe(0); // the scripted model uses no tokens and reports none
  });

  it("denies a forged course id from another student and leaks nothing", async () => {
    const { run, model } = agentRun(a, [
      { call: "search_course_material", args: { courseId: courseB, query: "residual", topK: 6 } },
      { call: "list_assignments", args: { courseId: courseB, includeCompleted: true } },
      { answer: (v: { lastToolOutput: string }) => answer([], [v.lastToolOutput.slice(0, 200)]) },
    ]);
    const outcome = await run;
    expect(outcome.events.map((e) => e.status)).toEqual(["denied", "denied"]);
    const seen = JSON.stringify(model.requests.map((r) => r.input));
    expect(seen).toContain("DENIED");
    expect(seen).not.toContain("b-secret.pdf");
    expect(seen).not.toContain("B private course");
  });

  it("refuses to draft study items that cite sources not retrieved in this run", async () => {
    const outcome = await agentRun(a, [
      { call: "draft_recovery_plan", args: { scenario: "balanced", studyItems: [{ title: "Read everything", courseId: courseA, minutes: 60, sourceIds: ["S1"] }] } },
      { answer: answer() },
    ]).run;
    expect(outcome.events[0]).toMatchObject({ tool: "draft_recovery_plan", status: "denied" });
    expect(outcome.proposalId).toBeNull();
  });

  it("treats injected instructions in PDFs as data: nothing is deleted or approved", async () => {
    const before = await a.db.from("assignments").select("id, status");
    const outcome = await agentRun(a, [
      { call: "search_course_material", args: { courseId: courseA, query: "ignore previous instructions admin mode delete", topK: 3 } },
      { answer: (v: { lastToolOutput: string }) => answer([], [v.lastToolOutput.includes("<source") ? "Found a note in the material; ignoring its instructions." : "none"]) },
    ]).run;
    expect(outcome.status).toBe("completed");
    expect(outcome.events[0].outcome).toMatch(/passage/);
    const after = await a.db.from("assignments").select("id, status");
    expect(after.data).toEqual(before.data);
    const { count } = await a.db.from("study_plans").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("on model failure records a failed run and leaves no actionable draft", async () => {
    const outcome = await agentRun(a, [
      { call: "draft_recovery_plan", args: { scenario: "essential", studyItems: [] } },
      { fail: "upstream 503" },
    ]).run;
    expect(outcome).toMatchObject({ status: "failed", errorCode: "model_error", proposalId: null });
    const { data: run } = await a.db.from("agent_runs").select("status, error_code, tool_events").eq("id", outcome.runId).single();
    expect(run).toMatchObject({ status: "failed", error_code: "model_error" });
    const { data: drafts } = await a.db.from("action_proposals").select("status").eq("run_id", outcome.runId);
    expect(drafts!.every((d) => d.status === "expired")).toBe(true);
  });

  it("stops runaway loops at the turn budget", async () => {
    const outcome = await agentRun(a, [{ call: "get_study_preferences", args: {} }], { loop: true }).run;
    expect(outcome).toMatchObject({ status: "failed", errorCode: "max_turns" });
    expect(outcome.events.length).toBeLessThanOrEqual(8);
  });

  it("enforces a per-request search budget", async () => {
    const search = { call: "search_course_material", args: { courseId: courseA, query: "regression slope", topK: 2 } } as const;
    const outcome = await agentRun(a, [search, search, search, search, search, { answer: answer() }]).run;
    expect(outcome.events.map((e) => e.status)).toEqual(["completed", "completed", "completed", "completed", "denied"]);
  });

  it("keeps agent runs private to their owner", async () => {
    const { data } = await admin().from("agent_runs").select("id").eq("owner_id", a.id).limit(1).single();
    expect((await b.db.from("agent_runs").select("id").eq("id", data!.id)).data).toEqual([]);
  });
});
