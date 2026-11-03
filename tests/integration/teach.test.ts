import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/errors";
import { processDocument } from "@/lib/rag/ingest";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { listTeachBack, teachBack } from "@/lib/teach/service";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let courseA: string;
let emptyCourse: string;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const EXPLANATION =
  "A residual is the observed value minus the predicted value. Least squares chooses the intercept and slope that minimise the sum of squared residuals, " +
  "so large residuals mean a poor fit for that observation. A residual plot helps spot nonlinear patterns and changing variance.";

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("teach-a"), signedInUser("teach-b")]);
  courseA = (await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  emptyCourse = (await a.db.from("courses").insert({ title: "Biology" }).select("id").single()).data!.id;
  const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
  const doc = await a.db.from("documents").insert({ course_id: courseA, filename: "module4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await a.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, documentId: doc.data!.id, embedder: null });
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("teach-it-back", () => {
  it("checks an explanation against the student's own pages and stores the attempt", async () => {
    const result = await teachBack({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId: courseA, topic: "residuals", explanation: EXPLANATION });
    expect(result.concepts.length).toBeGreaterThanOrEqual(3);
    expect(result.concepts.every((c) => c.citation.filename === "module4.pdf" && c.citation.page >= 1 && c.citation.page <= 4)).toBe(true);
    expect(result.coveragePercent).toBeGreaterThan(0);
    const history = await listTeachBack(asServer(a.db));
    expect(history[0]).toMatchObject({ id: result.id, topic: "residuals", coveragePercent: result.coveragePercent });
  });

  it("abstains when the notes don't cover the topic (nothing is stored)", async () => {
    const before = (await listTeachBack(asServer(a.db))).length;
    await expect(teachBack({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, courseId: emptyCourse, topic: "photosynthesis", explanation: EXPLANATION })).rejects.toMatchObject({ code: "no_evidence" });
    expect((await listTeachBack(asServer(a.db))).length).toBe(before);
  });

  it("denies another student's course and hides attempts across accounts", async () => {
    await expect(teachBack({ supabase: asServer(b.db), admin: adminDb(), userId: b.id, courseId: courseA, topic: "residuals", explanation: EXPLANATION })).rejects.toBeInstanceOf(ApiError);
    expect(await listTeachBack(asServer(b.db))).toEqual([]);
  });

  it("students can't write or forge attempts directly", async () => {
    const forged = await a.db.from("teach_back_attempts").insert({ owner_id: a.id, course_id: courseA, topic: "residuals", explanation: "x", coverage_percent: 100, concepts: [] });
    expect(forged.error?.code).toBe("42501");
    const { data } = await a.db.from("teach_back_attempts").select("id").limit(1);
    const update = await a.db.from("teach_back_attempts").update({ coverage_percent: 100 }).eq("id", data![0].id).select();
    expect(update.error?.code ?? (update.data?.length === 0 ? "none-updated" : "updated")).not.toBe("updated");
  });
});
