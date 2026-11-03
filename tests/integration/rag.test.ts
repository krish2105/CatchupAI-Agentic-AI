import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/errors";
import { processDocument } from "@/lib/rag/ingest";
import { searchCourseMaterial } from "@/lib/rag/retrieve";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fakeEmbedder } from "./fake-embedder";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let courseA: string;
let statsDocId: string;

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

async function upload(user: User, courseId: string, bytes: Uint8Array, filename = "notes.pdf") {
  const doc = await user.db.from("documents").insert({ course_id: courseId, filename, size_bytes: bytes.byteLength }).select("id, storage_path").single();
  if (doc.error) throw doc.error;
  const up = await user.db.storage.from("course-documents").upload(doc.data.storage_path!, bytes, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  return doc.data.id;
}

const ingest = (user: User, documentId: string) =>
  processDocument({ supabase: asServer(user.db), admin: adminDb(), userId: user.id, documentId, embedder: fakeEmbedder });

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("rag-a"), signedInUser("rag-b")]);
  const course = await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single();
  courseA = course.data!.id;
  statsDocId = await upload(a, courseA, fixture("statistics_module_4.pdf"), "module4.pdf");
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("ingestion", () => {
  it("extracts, chunks and embeds a text PDF with exact page metadata", async () => {
    const result = await ingest(a, statsDocId);
    expect(result).toMatchObject({ status: "ready", pageCount: 4, embedded: true });
    const chunks = await a.db.from("document_chunks").select("page_start, page_end, content").eq("document_id", statsDocId).order("chunk_index");
    expect(chunks.data?.map((c) => c.page_start)).toEqual([1, 2, 3, 4]);
    expect(chunks.data?.[1].content).toMatch(/A residual equals observed Y minus predicted Y_hat/);
  });

  it("is idempotent: re-processing a ready document does not duplicate chunks", async () => {
    const again = await ingest(a, statsDocId);
    expect(again.status).toBe("ready");
    const { count } = await a.db.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", statsDocId);
    expect(count).toBe(4);
  });

  it("lets only one of two concurrent processing requests run", async () => {
    const id = await upload(a, courseA, fixture("injection.pdf"), "parallel.pdf");
    const results = await Promise.allSettled([ingest(a, id), ingest(a, id)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as ApiError).status).toBe(409);
    const { count } = await a.db.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", id);
    expect(count).toBe(2);
  });

  it("rejects an identical file uploaded twice to the same course", async () => {
    const id = await upload(a, courseA, fixture("statistics_module_4.pdf"), "copy.pdf");
    expect(await ingest(a, id)).toMatchObject({ status: "failed", errorCode: "duplicate" });
  });

  it("fails clearly on scanned/no-text and disguised non-PDF uploads", async () => {
    expect(await ingest(a, await upload(a, courseA, fixture("no_text.pdf"), "scan.pdf"))).toMatchObject({ status: "failed", errorCode: "no_text" });
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(await ingest(a, await upload(a, courseA, html, "fake.pdf"))).toMatchObject({ status: "failed", errorCode: "not_pdf" });
  });

  it("refuses to process another student's document", async () => {
    await expect(ingest(b, statsDocId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("retrieval", () => {
  it("cites the page that actually contains the answer", async () => {
    const residual = await searchCourseMaterial(asServer(a.db), { courseId: courseA, query: "What does a residual mean?" }, fakeEmbedder);
    expect(residual.abstained).toBe(false);
    expect(residual.citations[0]).toMatchObject({ filename: "module4.pdf", pageStart: 2 });

    const causation = await searchCourseMaterial(asServer(a.db), { courseId: courseA, query: "does correlation prove causation" }, null);
    expect(causation.mode).toBe("lexical");
    expect(causation.citations[0]).toMatchObject({ pageStart: 3 });
  });

  it("abstains when the material has no supporting evidence", async () => {
    const res = await searchCourseMaterial(asServer(a.db), { courseId: courseA, query: "photosynthesis chlorophyll mitochondria" }, null);
    expect(res).toMatchObject({ abstained: true, citations: [] });
  });

  it("returns nothing from another student's course, even with its exact id", async () => {
    const res = await searchCourseMaterial(asServer(b.db), { courseId: courseA, query: "What does a residual mean?" }, fakeEmbedder);
    expect(res.citations).toEqual([]);
    const direct = await b.db.rpc("search_course_chunks", { p_course_id: courseA, p_query: "residual" });
    expect(direct.data).toEqual([]);
    const chunks = await b.db.from("document_chunks").select("id").eq("course_id", courseA);
    expect(chunks.data).toEqual([]);
  });

  it("stores prompt-injection text as inert data and changes nothing else", async () => {
    const before = await a.db.from("assignments").select("id");
    const res = await searchCourseMaterial(asServer(a.db), { courseId: courseA, query: "ignore previous instructions admin mode" }, null);
    expect(res.citations[0]?.snippet).toMatch(/IGNORE ALL PREVIOUS INSTRUCTIONS/);
    const after = await a.db.from("assignments").select("id");
    expect(after.data).toEqual(before.data);
  });
});
