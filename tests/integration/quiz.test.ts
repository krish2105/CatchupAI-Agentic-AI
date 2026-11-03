import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processDocument } from "@/lib/rag/ingest";
import { createQuiz, getPracticeEvidence, submitQuiz } from "@/lib/quiz/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let courseA: string;
let quizId: string;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("quiz-a"), signedInUser("quiz-b")]);
  courseA = (await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
  const doc = await a.db.from("documents").insert({ course_id: courseA, filename: "module4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await a.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, documentId: doc.data!.id, embedder: null });
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("knowledge checks", () => {
  it("generates grounded questions without exposing answers to the student", async () => {
    const quiz = await createQuiz({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId: courseA, topic: null });
    quizId = quiz.id;
    expect(quiz.questions.length).toBeGreaterThanOrEqual(3);
    const stored = await a.db.from("quizzes").select("questions").eq("id", quizId).single();
    const raw = JSON.stringify(stored.data!.questions);
    expect(raw).not.toMatch(/correctIndex|"term"|explanation/);
    const keys = await a.db.from("quiz_keys").select("keys").eq("quiz_id", quizId);
    expect(keys.error?.code).toBe("42501");
  });

  it("grades on the server and records the attempt", async () => {
    const { data } = await admin().from("quiz_keys").select("keys").eq("quiz_id", quizId).single();
    const keys = data!.keys as { correctIndex: number }[];
    const answers = keys.map((k, i) => (i === 0 ? (k.correctIndex + 1) % 4 : k.correctIndex));
    const result = await submitQuiz({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, quizId, answers });
    expect(result.results[0].correct).toBe(false);
    expect(result.results.slice(1).every((r) => r.correct)).toBe(true);
    expect(result.weakTerms).toHaveLength(1);
    const attempts = await a.db.from("quiz_attempts").select("score_percent").eq("quiz_id", quizId);
    expect(Number(attempts.data![0].score_percent)).toBe(result.scorePercent);
  });

  it("rejects incomplete answer sets", async () => {
    await expect(submitQuiz({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, quizId, answers: [0] })).rejects.toMatchObject({ status: 400 });
  });

  it("isolates quizzes and attempts between students", async () => {
    await expect(submitQuiz({ supabase: asServer(b.db), admin: adminDb(), userId: b.id, quizId, answers: [0, 0, 0, 0, 0] })).rejects.toMatchObject({ status: 404 });
    await expect(createQuiz({ supabase: asServer(b.db), admin: adminDb(), userId: b.id, courseId: courseA, topic: null })).rejects.toMatchObject({ status: 404 });
    expect((await b.db.from("quizzes").select("id").eq("id", quizId)).data).toEqual([]);
    expect((await b.db.from("quiz_attempts").select("id").eq("quiz_id", quizId)).data).toEqual([]);
    expect((await a.db.from("quiz_attempts").insert({ quiz_id: quizId, answers: [], results: [], score_percent: 100 } as never)).error?.code).toBe("42501");
  });

  it("refuses courses without enough material", async () => {
    const empty = (await a.db.from("courses").insert({ title: "Empty" }).select("id").single()).data!.id;
    await expect(createQuiz({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId: empty, topic: null })).rejects.toMatchObject({ status: 409 });
  });

  it("builds a revision queue from missed concepts and an adaptive retest that targets them", async () => {
    const evidence = await getPracticeEvidence(asServer(a.db), Date.now() + 2 * 86400_000);
    expect(evidence.revision.length).toBe(1);
    const missed = evidence.revision[0];
    expect(missed).toMatchObject({ box: 0, due: true, misses: 1 });
    expect(evidence.progress[0]).toMatchObject({ topic: "Whole course", attempts: 1 });

    const retest = await createQuiz({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId: courseA, topic: null, focusTerms: [missed.term] });
    expect(retest.topic).toBe(`Review: ${missed.term}`);
    const { data } = await admin().from("quiz_keys").select("keys").eq("quiz_id", retest.id).single();
    expect((data!.keys as { term: string }[]).map((k) => k.term)).toContain(missed.term.toLowerCase());
  });
});

