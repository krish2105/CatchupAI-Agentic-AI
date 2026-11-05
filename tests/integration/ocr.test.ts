import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetOpsFlagsCache, tokensUsedToday } from "@/lib/ai/guard";
import { getDocument, listDocuments } from "@/lib/db/documents";
import { ApiError } from "@/lib/http/errors";
import { processDocument, type IngestOcr } from "@/lib/rag/ingest";
import type { Ocr } from "@/lib/rag/ocr";
import { searchCourseMaterial } from "@/lib/rag/retrieve";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let course: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const scan = () => new Uint8Array(readFileSync("tests/fixtures/no_text.pdf"));

/** A valid PDF with `n` empty pages (a "scan" too long for OCR). Unique per call so it is never a duplicate. */
function blankPdf(n: number) {
  const objs = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [${Array.from({ length: n }, (_, i) => `${i + 3} 0 R`).join(" ")}] /Count ${n} >>`];
  for (let i = 0; i < n; i++) objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>`);
  let out = `%PDF-1.4\n%${crypto.randomUUID()}\n`;
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

async function upload(bytes: Uint8Array, filename: string) {
  const doc = await a.db.from("documents").insert({ course_id: course, filename, size_bytes: bytes.byteLength }).select("id, storage_path").single();
  if (doc.error) throw doc.error;
  const up = await a.db.storage.from("course-documents").upload(doc.data.storage_path!, bytes, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  return doc.data.id;
}

function fakeOcr(result: (pageCount: number) => { pages: string[]; usage: { inputTokens: number; outputTokens: number } } | Error) {
  const calls: number[] = [];
  const reader: Ocr = {
    model: "fake-ocr-model",
    async read(_pdf, pageCount) {
      calls.push(pageCount);
      const r = result(pageCount);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { reader, calls };
}

const ingest = (documentId: string, ocr: IngestOcr | null) => processDocument({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, documentId, embedder: null, ocr });
const LECTURE = "Lecture 7: Hypothesis testing. A p-value is the probability of data at least this extreme if the null hypothesis is true.";

beforeAll(async () => {
  a = await signedInUser("ocr-a");
  course = (await a.db.from("courses").insert({ title: "Scanned notes" }).select("id").single()).data!.id;
});
afterEach(async () => {
  await admin().from("ops_flags").update({ ai_enabled: true }).eq("id", 1);
  resetOpsFlagsCache();
});
afterAll(async () => {
  if (a) await deleteUser(a.id);
});

describe("OCR for scanned PDFs", () => {
  it("reads a scan, indexes the text for search, marks it as OCR and counts its tokens towards the daily budget", async () => {
    const before = await tokensUsedToday(adminDb());
    const { reader, calls } = fakeOcr((n) => ({ pages: Array.from({ length: n }, (_, i) => (i === 0 ? LECTURE : "")), usage: { inputTokens: 700, outputTokens: 90 } }));
    const id = await upload(scan(), "scan.pdf");
    expect(await ingest(id, { reader })).toMatchObject({ status: "ready", ocr: true });
    expect(calls).toHaveLength(1);
    const { data: row } = await admin().from("documents").select("text_source, ocr_model, ocr_input_tokens, ocr_output_tokens").eq("id", id).single();
    expect(row).toEqual({ text_source: "ocr", ocr_model: "fake-ocr-model", ocr_input_tokens: 700, ocr_output_tokens: 90 });
    expect(await tokensUsedToday(adminDb())).toBeGreaterThanOrEqual(before + 790);
    expect(await getDocument(asServer(a.db), id)).toMatchObject({ status: "ready", textSource: "ocr" });
    expect((await listDocuments(asServer(a.db), course)).find((d) => d.id === id)).toMatchObject({ textSource: "ocr" });
    const hits = await searchCourseMaterial(asServer(a.db), { courseId: course, query: "p-value null hypothesis" }, null);
    expect(hits.abstained).toBe(false);
    expect(hits.citations[0]).toMatchObject({ documentId: id, pageStart: 1 });
  });

  it("checks for a duplicate before OCR, so the same scan never costs a second call", async () => {
    const { reader, calls } = fakeOcr(() => ({ pages: [LECTURE], usage: { inputTokens: 1, outputTokens: 1 } }));
    expect(await ingest(await upload(scan(), "scan-again.pdf"), { reader })).toMatchObject({ status: "failed", errorCode: "duplicate" });
    expect(calls).toEqual([]);
  });

  it("doesn't call the model when AI is paused or the student's daily limit is used, and says why", async () => {
    await admin().from("documents").delete().eq("owner_id", a.id).eq("text_source", "ocr");
    const { reader, calls } = fakeOcr(() => ({ pages: [LECTURE], usage: { inputTokens: 1, outputTokens: 1 } }));
    await admin().from("ops_flags").update({ ai_enabled: false }).eq("id", 1);
    resetOpsFlagsCache();
    expect(await ingest(await upload(scan(), "paused.pdf"), { reader })).toMatchObject({ status: "failed", errorCode: "ocr_unavailable" });
    await admin().from("ops_flags").update({ ai_enabled: true }).eq("id", 1);
    resetOpsFlagsCache();
    await admin().from("documents").delete().eq("owner_id", a.id).eq("filename", "paused.pdf");
    const limited = { reader, beforeUse: async () => { throw new ApiError(429, "rate_limited", "Too many requests."); } };
    const id = await upload(scan(), "limited.pdf");
    expect(await ingest(id, limited)).toMatchObject({ status: "failed", errorCode: "ocr_unavailable" });
    expect(calls).toEqual([]);
    expect((await getDocument(asServer(a.db), id)).errorMessage).toMatch(/paused or at today's limit/);
    await admin().from("documents").delete().eq("id", id);
  });

  it("fails as a scan (and still counts the tokens) when OCR finds no text or the model errors", async () => {
    const empty = fakeOcr((n) => ({ pages: Array.from({ length: n }, () => ""), usage: { inputTokens: 300, outputTokens: 2 } }));
    const id = await upload(scan(), "blank-scan.pdf");
    expect(await ingest(id, { reader: empty.reader })).toMatchObject({ status: "failed", errorCode: "no_text" });
    const { data: row } = await admin().from("documents").select("text_source, ocr_input_tokens").eq("id", id).single();
    expect(row).toEqual({ text_source: "ocr", ocr_input_tokens: 300 });
    await admin().from("documents").delete().eq("id", id);
    const broken = fakeOcr(() => Object.assign(new Error("OCR request failed with 503"), { status: 503 }));
    expect(await ingest(await upload(scan(), "busy.pdf"), { reader: broken.reader })).toMatchObject({ status: "failed", errorCode: "no_text" });
  });

  it("refuses scans over 20 pages without calling the model, and never uses OCR for a PDF with text", async () => {
    const { reader, calls } = fakeOcr(() => ({ pages: [], usage: { inputTokens: 0, outputTokens: 0 } }));
    expect(await ingest(await upload(blankPdf(21), "long-scan.pdf"), { reader })).toMatchObject({ status: "failed", errorCode: "ocr_too_many_pages" });
    const text = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
    expect(await ingest(await upload(text, "text.pdf"), { reader })).toMatchObject({ status: "ready" });
    expect(calls).toEqual([]);
    const { data: row } = await admin().from("documents").select("text_source").eq("owner_id", a.id).eq("filename", "text.pdf").single();
    expect(row!.text_source).toBe("pdf");
  });

  it("without OCR configured, a scan fails exactly as before", async () => {
    await admin().from("documents").delete().eq("owner_id", a.id).eq("filename", "busy.pdf");
    expect(await ingest(await upload(scan(), "no-ocr.pdf"), null)).toMatchObject({ status: "failed", errorCode: "no_text" });
  });
});
