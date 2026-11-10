import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { answerItem, getMasteryMap, startDiagnostic, startPractice, takeHint, type SessionInfo } from "@/lib/mastery/service";
import { processDocument } from "@/lib/rag/ingest";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let docA: string;
let docB: string;
let session: SessionInfo;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const deps = (u: User) => ({ supabase: asServer(u.db), admin: adminDb(), userId: u.id });
const keyOf = async (itemId: string) => (await admin().from("assessment_keys").select("answer_index").eq("item_id", itemId).single()).data!.answer_index;

async function lectureFor(u: User) {
  const course = (await u.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
  const doc = await u.db.from("documents").insert({ course_id: course, filename: "module4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await u.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(u.db), admin: adminDb(), userId: u.id, documentId: doc.data!.id, embedder: null });
  return doc.data!.id;
}

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("mastery-a"), signedInUser("mastery-b")]);
  [docA, docB] = await Promise.all([lectureFor(a), lectureFor(b)]);
});

beforeEach(() => {
  // Never reach a real model from tests: the scripted agent stands in, and the real key is blanked.
  vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
  vi.stubEnv("OPENAI_API_KEY", "");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("Diagnostician warm-up", () => {
  it("writes one grounded question per key concept and records its own agent run", async () => {
    session = await startDiagnostic({ ...deps(a), documentId: docA });
    expect(session.mode).toBe("diagnostic");
    expect(session.items.length).toBeGreaterThanOrEqual(2);
    expect(session.items.length).toBeLessThanOrEqual(6);
    expect(session.agent).toMatchObject({ name: "Diagnostician", model: "scripted-test-model" });
    expect(session.agent.agentWritten).toBe(session.items.length);
    expect(new Set(session.items.map((i) => i.concept)).size).toBe(session.items.length);
    const run = await a.db.from("agent_runs").select("agent, status, model, tool_events").eq("id", session.agent.runId!).single();
    expect(run.data).toMatchObject({ agent: "diagnostician", status: "completed", model: "scripted-test-model" });
    expect(JSON.stringify(run.data!.tool_events)).toContain("write_warmup_questions");
  });

  it("never lets the student read answer keys", async () => {
    const keys = await a.db.from("assessment_keys").select("answer_index").limit(1);
    expect(keys.error?.code).toBe("42501");
    const items = await a.db.from("assessment_items").select("*").eq("session_id", session.sessionId);
    expect(JSON.stringify(items.data)).not.toMatch(/answer_index|"hint"|"quote"/);
  });

  it("a hint never contains the answer, and no hints are given after answering", async () => {
    const item = session.items[1];
    const { data: row } = await admin().from("assessment_items").select("options").eq("id", item.id).single();
    const correct = (row!.options as string[])[await keyOf(item.id)].replace(/\.\.\.$/, "");
    const hint = await takeHint({ ...deps(a), itemId: item.id, level: 2 });
    expect(hint.hint.toLowerCase()).not.toContain(correct.toLowerCase());
    const result = await answerItem({ ...deps(a), itemId: item.id, chosen: await keyOf(item.id), confidence: "sure", elapsedMs: 9000 });
    // A hint was used, so a correct answer counts like a guess: not yet "known".
    expect(result.mastery.status).toBe("shaky");
    await expect(takeHint({ ...deps(a), itemId: item.id, level: 1 })).rejects.toMatchObject({ status: 409 });
  });

  it("grades once on the server and updates the mastery map", async () => {
    const [first, ...rest] = session.items.filter((_, i) => i !== 1);
    const sure = await answerItem({ ...deps(a), itemId: first.id, chosen: await keyOf(first.id), confidence: "sure", elapsedMs: 8000 });
    expect(sure).toMatchObject({ correct: true, mastery: { status: "known" } });
    expect(sure.explanation.page).toBe(first.page);
    await expect(answerItem({ ...deps(a), itemId: first.id, chosen: 0, confidence: "sure", elapsedMs: 1000 })).rejects.toMatchObject({ status: 409 });
    for (const item of rest) {
      const wrong = ((await keyOf(item.id)) + 1) % 4;
      const r = await answerItem({ ...deps(a), itemId: item.id, chosen: wrong, confidence: "sure", elapsedMs: 7000 });
      expect(r).toMatchObject({ correct: false, mastery: { status: "confidently_wrong" } });
    }
    const map = await getMasteryMap(asServer(a.db), docA);
    expect(map.tested).toBe(session.items.length);
    expect(map.concepts.find((c) => c.concept === first.concept)?.status).toBe("known");
    expect(map.bridge[0].status).toBe("confidently_wrong");
    expect(map.bridge.some((c) => c.concept === first.concept)).toBe(false);
  });
});

describe("Quizmaster practice", () => {
  it("targets the gaps first and records a Quizmaster run", async () => {
    const map = await getMasteryMap(asServer(a.db), docA);
    const practice = await startPractice({ ...deps(a), documentId: docA, mode: "practice" });
    const gaps = new Set(map.bridge.slice(0, 3).map((c) => c.concept));
    expect(practice.items.every((i) => gaps.has(i.concept))).toBe(true);
    expect(practice.items.every((i) => i.timeLimitSeconds === null)).toBe(true);
    const run = await a.db.from("agent_runs").select("agent, status").eq("id", practice.agent.runId!).single();
    expect(run.data).toMatchObject({ agent: "quizmaster", status: "completed" });
  });

  it("timed rehearsal uses only known concepts, has no hints and a 45-second limit", async () => {
    const rehearsal = await startPractice({ ...deps(a), documentId: docA, mode: "rehearsal" });
    const known = new Set((await getMasteryMap(asServer(a.db), docA)).concepts.filter((c) => c.status === "known").map((c) => c.concept));
    expect(rehearsal.items.every((i) => known.has(i.concept) && i.timeLimitSeconds === 45)).toBe(true);
    await expect(takeHint({ ...deps(a), itemId: rehearsal.items[0].id, level: 1 })).rejects.toMatchObject({ status: 409 });
    // Running out of time counts as wrong, never as "confidently wrong".
    const late = await answerItem({ ...deps(a), itemId: rehearsal.items[0].id, chosen: null, confidence: "sure", elapsedMs: 60_000 });
    expect(late).toMatchObject({ correct: false, timedOut: true });
    expect(late.mastery.status).not.toBe("confidently_wrong");
  });

  it("refuses practice before the warm-up and rehearsal before anything is known", async () => {
    await expect(startPractice({ ...deps(b), documentId: docB, mode: "practice" })).rejects.toMatchObject({ status: 409, code: "warmup_first" });
    const warmup = await startDiagnostic({ ...deps(b), documentId: docB });
    for (const item of warmup.items) await answerItem({ ...deps(b), itemId: item.id, chosen: ((await keyOf(item.id)) + 1) % 4, confidence: "guess", elapsedMs: 5000 });
    await expect(startPractice({ ...deps(b), documentId: docB, mode: "rehearsal" })).rejects.toMatchObject({ status: 409, code: "rehearsal_locked" });
  });
});

describe("isolation and fallback", () => {
  it("one student can't read or answer another student's assessment or mastery", async () => {
    expect((await b.db.from("concept_mastery").select("id").eq("document_id", docA)).data).toEqual([]);
    expect((await b.db.from("assessment_items").select("id").eq("session_id", session.sessionId)).data).toEqual([]);
    expect((await b.db.from("assessment_attempts").select("id").eq("owner_id", a.id)).data).toEqual([]);
    await expect(answerItem({ ...deps(b), itemId: session.items[0].id, chosen: 0, confidence: "sure", elapsedMs: 1000 })).rejects.toMatchObject({ status: 404 });
    await expect(getMasteryMap(asServer(b.db), docA)).rejects.toMatchObject({ status: 404 });
    await expect(startDiagnostic({ ...deps(b), documentId: docA })).rejects.toMatchObject({ status: 404 });
  });

  it("students can't write mastery or attempts directly", async () => {
    const forged = await a.db.from("concept_mastery").update({ status: "known" }).eq("document_id", docA).select("id");
    expect(forged.error?.code ?? (forged.data?.length === 0 ? "none" : "updated")).not.toBe("updated");
    const insert = await a.db.from("assessment_attempts").insert({ owner_id: a.id, item_id: session.items[0].id, correct: true, confidence: "sure" });
    expect(insert.error).not.toBeNull();
  });

  it("without any AI model, the warm-up still works with fill-the-gap questions and records no agent run", async () => {
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    const before = (await a.db.from("agent_runs").select("id", { count: "exact", head: true }).eq("agent", "diagnostician")).count ?? 0;
    const fallback = await startDiagnostic({ ...deps(a), documentId: docA });
    expect(fallback.agent).toMatchObject({ model: null, runId: null, agentWritten: 0 });
    expect(fallback.items.every((i) => i.source === "cloze" && i.prompt.includes("_____"))).toBe(true);
    const after = (await a.db.from("agent_runs").select("id", { count: "exact", head: true }).eq("agent", "diagnostician")).count ?? 0;
    expect(after).toBe(before);
  });
});
