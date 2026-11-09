import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Embedder } from "@/lib/rag/embed";
import { processDocument } from "@/lib/rag/ingest";
import { reembedDocuments } from "@/lib/rag/reembed";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fakeEmbedder } from "./fake-embedder";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let docA: string;
let docB: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

/** A different embedding model (as when the provider changes): same dimensions, different vectors. */
const nextModel: Embedder = { provider: "openai", model: "test-hash-embedder-v2", embed: (texts) => fakeEmbedder.embed(texts.map((t) => `${t} reembedded secondmodel vectors`)) };

async function ingest(user: User, embedder: Embedder | null) {
  const course = (await user.db.from("courses").insert({ title: "Statistics" }).select("id").single()).data!.id;
  const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
  const doc = await user.db.from("documents").insert({ course_id: course, filename: "module4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await user.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(user.db), admin: adminDb(), userId: user.id, documentId: doc.data!.id, embedder });
  return doc.data!.id;
}

const state = async (documentId: string) => {
  const doc = await admin().from("documents").select("embedding_model").eq("id", documentId).single();
  const chunks = await admin().from("document_chunks").select("id, embedding").eq("document_id", documentId).order("chunk_index");
  return { model: doc.data!.embedding_model, vectors: (chunks.data ?? []).map((c) => c.embedding as string | null) };
};

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("reembed-a"), signedInUser("reembed-b")]);
  [docA, docB] = await Promise.all([ingest(a, fakeEmbedder), ingest(b, null)]);
}, 120_000);

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("re-embedding documents after an embedding model change", () => {
  it("only reports what it would do unless asked to apply", async () => {
    const before = await state(docA);
    const report = await reembedDocuments({ admin: adminDb(), embedder: nextModel, ownerId: a.id, apply: false });
    expect(report).toMatchObject({ applied: false, documents: 1, updated: 0 });
    expect(report.chunks).toBeGreaterThan(0);
    expect(await state(docA)).toEqual(before);
  });

  it("re-embeds every chunk with the current model, for the chosen student only", async () => {
    const beforeA = await state(docA);
    const beforeB = await state(docB);
    const report = await reembedDocuments({ admin: adminDb(), embedder: nextModel, ownerId: a.id, apply: true });
    expect(report).toMatchObject({ applied: true, documents: 1, updated: 1 });
    const afterA = await state(docA);
    expect(afterA.model).toBe("test-hash-embedder-v2");
    expect(afterA.vectors.every((v, i) => v !== null && v !== beforeA.vectors[i])).toBe(true);
    expect(await state(docB)).toEqual(beforeB);
  });

  it("skips documents already on the current model, and gives keyword-only documents vectors", async () => {
    expect(await reembedDocuments({ admin: adminDb(), embedder: nextModel, ownerId: a.id, apply: true })).toMatchObject({ documents: 0, updated: 0 });
    expect((await state(docB)).model).toBeNull();
    await reembedDocuments({ admin: adminDb(), embedder: nextModel, ownerId: b.id, apply: true });
    const after = await state(docB);
    expect(after.model).toBe("test-hash-embedder-v2");
    expect(after.vectors.every((v) => v !== null)).toBe(true);
  });
});
