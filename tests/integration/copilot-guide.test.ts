import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runRecoveryAgent, type CopilotMode } from "@/lib/agents/recovery-agent";
import { ScriptedModel, ScriptedProvider, type ScriptStep, type ScriptView } from "@/lib/agents/testing/scripted-model";
import { resolveThread } from "@/lib/agents/threads";
import { processDocument } from "@/lib/rag/ingest";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fakeEmbedder } from "./fake-embedder";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let courseId: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

async function run(message: string, steps: ScriptStep[], mode: CopilotMode, threadId: string | null = null) {
  const model = new ScriptedModel(steps);
  const outcome = await runRecoveryAgent({
    supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId, message,
    runtime: { provider: new ScriptedProvider(model), model: "scripted-test-model" },
    embedder: fakeEmbedder, now: Date.now(), judge: null, threadId, mode,
  });
  return { outcome, model };
}

/** A guiding question built on the retrieved page, which it quotes and cites (the claim check needs a real quote). */
const guidingAnswer = (v: ScriptView) => {
  const source = /<source id="S1" file="[^"]+" page="\d+">\n([\s\S]*?)\n<\/source>/.exec(v.toolOutputs.join("\n"));
  return {
    scope: "catchup",
    facts: source ? [{ statement: `Your notes say: "${source[1].slice(0, 120)}"`, sourceIds: ["S1"] }] : [],
    suggestions: [],
    clarifyingQuestion: "Looking at that passage, what do you think a residual compares?",
    followUps: [],
  };
};

beforeAll(async () => {
  a = await signedInUser("guide-a");
  courseId = (await a.db.from("courses").insert({ title: "Statistics" }).select("id").single()).data!.id;
  const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
  const doc = await a.db.from("documents").insert({ course_id: courseId, filename: "module4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await a.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, documentId: doc.data!.id, embedder: fakeEmbedder });
}, 120_000);

afterAll(async () => {
  if (a) await deleteUser(a.id);
});

describe("Socratic guide mode", () => {
  it("asks one guiding question grounded in a cited page, and still checks citations", async () => {
    const { outcome, model } = await run("What is a residual?", [{ call: "search_course_material", args: { courseId, query: "residual", topK: 3 } }, { answer: guidingAnswer }], "guide");
    expect(model.requests[0].systemInstructions).toContain("Guide mode");
    expect(JSON.stringify(model.requests[0].input)).toContain("0 earlier attempts");
    expect(outcome.answer?.clarifyingQuestion).toMatch(/what do you think/i);
    expect(outcome.answer?.facts).toHaveLength(1);
    expect(outcome.citations).toHaveLength(1);
  });

  it("tells the model how many attempts the student has made in this conversation", async () => {
    const threadId = (await resolveThread(asServer(a.db), adminDb(), a.id, null, "What is a residual?"))!;
    const answerOnly = (q: string): ScriptStep => ({ answer: { scope: "catchup", facts: [], suggestions: [], clarifyingQuestion: q, followUps: [] } });
    await run("What is a residual?", [answerOnly("What do the notes compare?")], "guide", threadId);
    await run("Is it the actual value?", [answerOnly("Close: actual compared with what?")], "guide", threadId);
    const third = await run("Actual minus predicted?", [answerOnly("Yes.")], "guide", threadId);
    expect(JSON.stringify(third.model.requests[0].input)).toContain("2 earlier attempts");
  });

  it("leaves the normal mode unchanged", async () => {
    const { model } = await run("What is a residual?", [{ answer: { scope: "catchup", facts: [], suggestions: ["Read page 2."], clarifyingQuestion: null, followUps: [] } }], "answer");
    expect(model.requests[0].systemInstructions).not.toContain("Guide mode");
    expect(JSON.stringify(model.requests[0].input)).not.toContain("earlier attempt");
  });
});
