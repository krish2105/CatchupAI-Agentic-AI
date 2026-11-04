import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runRecoveryAgent, type AnswerStreamEvent } from "@/lib/agents/recovery-agent";
import { ScriptedModel, ScriptedProvider, type ScriptStep } from "@/lib/agents/testing/scripted-model";
import { clearToolCache, invalidateStudent } from "@/lib/agents/tool-cache";
import { RECOVERY_TOOLS } from "@/lib/agents/tools";
import { getAgentRun } from "@/lib/db/agent-runs";
import { VerdictCache, type JudgeClient } from "@/lib/rag/faithfulness-judge";
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

function agentRun(user: User, steps: ScriptStep[], opts: { loop?: boolean; courseId?: string | null; message?: string; fallback?: ScriptStep[]; onAnswer?: (e: AnswerStreamEvent) => void; judge?: JudgeClient } = {}) {
  const model = new ScriptedModel(steps, opts.loop);
  const fallbackModel = opts.fallback ? new ScriptedModel(opts.fallback) : null;
  return {
    model,
    fallbackModel,
    run: runRecoveryAgent({
      supabase: asServer(user.db),
      admin: adminDb(),
      userId: user.id,
      courseId: opts.courseId ?? null,
      message: opts.message ?? "I missed Module 4 and my worksheet is due soon. What should I do?",
      runtime: {
        provider: new ScriptedProvider(model),
        model: "scripted-test-model",
        ...(fallbackModel ? { fallback: { provider: new ScriptedProvider(fallbackModel), model: "scripted-fallback-model" } } : {}),
      },
      embedder: fakeEmbedder,
      now: Date.now(),
      onAnswer: opts.onAnswer,
      judge: opts.judge ? { client: opts.judge, cache: new VerdictCache() } : null,
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

  it("with the AI judge on: removes a fact the judge rejects after the word check, holds facts from the stream and counts judge tokens", async () => {
    const judged: string[] = [];
    const judge: JudgeClient = {
      model: "fake-judge",
      async complete(_system, user) {
        const items = [...user.matchAll(/<item id="([^"]+)">\nClaim: ([^\n]*)/g)];
        judged.push(...items.map((m) => m[2]));
        // Rejects the overstated claim even though its words are all in the passage.
        return { text: JSON.stringify({ verdicts: items.map((m) => ({ id: m[1], supported: !/always/.test(m[2]), reason: "fake" })) }), usage: { inputTokens: 120, outputTokens: 15 } };
      },
    };
    const events: AnswerStreamEvent[] = [];
    const { run } = agentRun(
      a,
      [
        { call: "search_course_material", args: { courseId: courseA, query: "What does a residual mean?", topK: 4 } },
        {
          answer: answer([
            { statement: "A residual is observed Y minus predicted Y-hat.", sourceIds: ["S1"] },
            { statement: "A residual always equals observed Y minus predicted Y-hat.", sourceIds: ["S1"] },
            { statement: "The regression worksheet is due in five days.", sourceIds: [] },
          ]),
        },
      ],
      { judge, onAnswer: (e) => events.push(e) },
    );
    const outcome = await run;
    expect(outcome.status).toBe("completed");
    expect(judged).toHaveLength(2); // only cited facts reach the judge
    expect(outcome.answer!.facts.map((f) => f.statement)).toEqual(["A residual is observed Y minus predicted Y-hat.", "The regression worksheet is due in five days."]);
    expect(outcome.removedUnsupportedFacts).toBe(1);
    expect(events.some((e) => e.type === "fact")).toBe(false);
    const { data: stored } = await a.db.from("agent_runs").select("summary, input_tokens, output_tokens").eq("id", outcome.runId).single();
    expect(stored).toMatchObject({ input_tokens: 120, output_tokens: 15 });
    expect(stored!.summary).not.toContain("always equals");
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

  it("falls back once to the second model on a daily quota, and records which model answered and why", async () => {
    const { run, fallbackModel } = agentRun(a, [{ call: "get_study_preferences", args: {} }, { fail: "Quota exceeded: GenerateRequestsPerDayPerProjectPerModel", status: 429 }], {
      fallback: [{ call: "list_assignments", args: { courseId: null, includeCompleted: false } }, { answer: answer() }],
    });
    const outcome = await run;
    expect(outcome).toMatchObject({ status: "completed", model: "scripted-fallback-model", fallbackFrom: "scripted-test-model", fallbackReason: "model_quota" });
    expect(fallbackModel!.turn).toBe(2);
    // Both attempts' tool calls really ran; the trace says which attempt each belongs to.
    expect(outcome.events.map((e) => [e.tool, e.attempt ?? 1])).toEqual([["get_study_preferences", 1], ["list_assignments", 2]]);
    const { data: stored } = await a.db.from("agent_runs").select("status, model, fallback_from, fallback_reason").eq("id", outcome.runId).single();
    expect(stored).toEqual({ status: "completed", model: "scripted-fallback-model", fallback_from: "scripted-test-model", fallback_reason: "model_quota" });
  });

  it("expires the primary attempt's draft before the fallback drafts again, so only one draft stays actionable", async () => {
    const draft = { call: "draft_recovery_plan", args: { scenario: "essential", studyItems: [] } } as const;
    const outcome = await agentRun(a, [draft, { fail: "The model is overloaded", status: 503 }], { fallback: [draft, { answer: answer() }] }).run;
    expect(outcome).toMatchObject({ status: "completed", fallbackReason: "model_overloaded" });
    const { data: drafts } = await a.db.from("action_proposals").select("id, status").eq("run_id", outcome.runId);
    expect(drafts!.filter((d) => d.status === "pending").map((d) => d.id)).toEqual([outcome.proposalId]);
    expect(drafts!.filter((d) => d.status === "expired")).toHaveLength(1);
  });

  it("does not fall back on errors a second model wouldn't fix", async () => {
    const { run, fallbackModel } = agentRun(a, [{ fail: "Invalid request", status: 400 }], { fallback: [{ answer: answer() }] });
    const outcome = await run;
    expect(outcome).toMatchObject({ status: "failed", errorCode: "model_error" });
    expect(fallbackModel!.turn).toBe(0);
    const { data: stored } = await a.db.from("agent_runs").select("model, fallback_from, fallback_reason").eq("id", outcome.runId).single();
    expect(stored).toEqual({ model: "scripted-test-model", fallback_from: null, fallback_reason: null });
  });

  it("tries the fallback only once: if it also fails, the run fails safely with both facts recorded", async () => {
    const outcome = await agentRun(a, [{ fail: "busy", status: 429 }], { fallback: [{ fail: "busy too", status: 503 }] }).run;
    expect(outcome).toMatchObject({ status: "failed", errorCode: "model_overloaded", proposalId: null });
    const { data: stored } = await a.db.from("agent_runs").select("status, model, fallback_from, fallback_reason, error_code").eq("id", outcome.runId).single();
    expect(stored).toEqual({ status: "failed", model: "scripted-fallback-model", fallback_from: "scripted-test-model", fallback_reason: "model_busy", error_code: "model_overloaded" });
  });

  it("streams the answer while the model writes it: verified facts with pages, suggestions word by word", async () => {
    const streamed: AnswerStreamEvent[] = [];
    const outcome = await agentRun(
      a,
      [
        { call: "search_course_material", args: { courseId: courseA, query: "What does a residual mean?", topK: 4 } },
        {
          answer: answer(
            [
              { statement: "A residual is observed Y minus predicted Y-hat.", sourceIds: ["S1"] },
              { statement: "Invented fact citing a source that was never retrieved.", sourceIds: ["S9"] },
            ],
            ["Start with the regression worksheet tonight, then review residual plots."],
          ),
        },
      ],
      { onAnswer: (e) => streamed.push(e) },
    ).run;
    expect(outcome.status).toBe("completed");
    const facts = streamed.filter((e) => e.type === "fact");
    // The unsupported fact was never shown, not even briefly.
    expect(facts.map((f) => f.type === "fact" && f.fact.statement)).toEqual(["A residual is observed Y minus predicted Y-hat."]);
    expect(facts[0]).toMatchObject({ citations: [{ filename: "module4.pdf", page: 2 }] });
    const texts = streamed.filter((e) => e.type === "text");
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.at(-1)).toMatchObject({ suggestions: outcome.answer!.suggestions });
  });

  it("serves repeated reads from the cache within a run, marks them in the trace, and refetches after a write", async () => {
    clearToolCache();
    const prefs = { call: "get_study_preferences", args: {} } as const;
    const list = { call: "list_assignments", args: { courseId: null, includeCompleted: false } } as const;
    const first = await agentRun(a, [prefs, list, prefs, list, { answer: answer() }]).run;
    expect(first.events.map((e) => [e.tool, e.cached ?? false])).toEqual([
      ["get_study_preferences", false],
      ["list_assignments", false],
      ["get_study_preferences", true],
      ["list_assignments", true],
    ]);
    // A second question seconds later reuses the same reads.
    const second = await agentRun(a, [list, { answer: answer() }]).run;
    expect(second.events[0]).toMatchObject({ tool: "list_assignments", cached: true });

    // Any write clears the student's cache, so the next read sees the new data.
    await a.db.from("assignments").insert({ course_id: courseA, title: "Cache check quiz", due_at: days(6), estimated_minutes: 30 });
    invalidateStudent(a.id); // what every authenticated write request does (see tool-cache unit tests)
    const third = await agentRun(a, [list, { answer: answer() }]).run;
    expect(third.events[0].cached).toBeUndefined();
    expect(third.events[0].outcome).toMatch(/2 assignments/);
    await a.db.from("assignments").delete().eq("title", "Cache check quiz");
    invalidateStudent(a.id);
  });

  it("never serves one student's cached reads to another", async () => {
    clearToolCache();
    const list = { call: "list_assignments", args: { courseId: null, includeCompleted: false } } as const;
    const runA = await agentRun(a, [list, { answer: answer() }]).run;
    const runB = await agentRun(b, [list, { answer: answer() }]).run;
    expect(runA.events[0].outcome).toMatch(/assignment/);
    expect(runB.events[0]).toMatchObject({ outcome: "0 assignments" });
    expect(runB.events[0].cached).toBeUndefined();
  });

  it("caches course search per student and query, without repeating the embedding request", async () => {
    clearToolCache();
    let embeds = 0;
    const counting = { ...fakeEmbedder, embed: async (texts: string[]) => { embeds++; return fakeEmbedder.embed(texts); } };
    const search = { call: "search_course_material", args: { courseId: courseA, query: "What does a residual mean?", topK: 4 } } as const;
    const model = new ScriptedModel([search, search, { answer: answer() }]);
    const outcome = await runRecoveryAgent({
      supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId: courseA, message: "What does a residual mean?",
      runtime: { provider: new ScriptedProvider(model), model: "scripted-test-model" }, embedder: counting, now: Date.now(),
    });
    expect(outcome.events.map((e) => e.cached ?? false)).toEqual([false, true]);
    expect(embeds).toBe(1);
    // The same passage keeps the same source id in this run.
    expect([...JSON.stringify(model.requests[2].input).matchAll(/\[S(\d+)\]/g)].map((m) => m[1]).every((id) => id === "1" || id === "2" || id === "3" || id === "4")).toBe(true);
  });

  it("the draft tool reports the plan's self-check to the model, and the run shows it", async () => {
    const { run, model } = agentRun(a, [{ call: "draft_recovery_plan", args: { scenario: "essential", studyItems: [] } }, { answer: answer() }]);
    const outcome = await run;
    expect(JSON.stringify(model.requests[1].input)).toMatch(/selfCheck.*Self-check passed/);
    const dto = await getAgentRun(asServer(a.db), outcome.runId);
    expect(dto.proposal).toMatchObject({ status: "pending", selfCheck: { status: "pass" } });
  });

  it("keeps agent runs private to their owner", async () => {
    const { data } = await admin().from("agent_runs").select("id").eq("owner_id", a.id).limit(1).single();
    expect((await b.db.from("agent_runs").select("id").eq("id", data!.id)).data).toEqual([]);
  });
});
