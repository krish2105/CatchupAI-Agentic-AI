/**
 * RAG quality evaluation against the REAL ingestion + retrieval path on local Supabase, using the synthetic
 * fixtures in tests/fixtures/rag and the gold set in evals/rag/gold.json. Also measures the claim-support
 * checker against evals/rag/claims.json. Writes evals/results/rag-latest.json and evals/RAG_REPORT.md.
 *   npm run db:start && npm run eval
 */
import { readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import claims from "./rag/claims.json";
import gold from "./rag/gold.json";
import { claimSupport, SUPPORT_THRESHOLD } from "@/lib/rag/claim-support";
import { getEmbedder } from "@/lib/rag/embed";
import { processDocument } from "@/lib/rag/ingest";
import { EVIDENCE_THRESHOLD, searchCourseMaterial } from "@/lib/rag/retrieve";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "../tests/integration/helpers";

type User = { id: string; db: Db };
let a: User;
let b: User;
let biology: string;
let stats: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const embedder = getEmbedder();
const K = gold.k;

async function ingest(user: User, courseId: string, path: string, filename: string) {
  const bytes = new Uint8Array(readFileSync(path));
  const doc = await user.db.from("documents").insert({ course_id: courseId, filename, size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await user.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(user.db), admin: admin() as unknown as AdminSupabase, userId: user.id, documentId: doc.data!.id, embedder });
  return doc.data!.id as string;
}

type Row = { id: string; type: string; query: string; retrieved: string[]; firstRelevantRank: number | null; recall1: boolean; recallK: boolean; precisionK: number | null; requiredAll: boolean | null; abstained: boolean; correct: boolean; ms: number };
const rows: Row[] = [];
const checks: { name: string; pass: boolean; detail: string }[] = [];

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("rag-a"), signedInUser("rag-b")]);
  biology = (await a.db.from("courses").insert({ title: "Biology unit 2" }).select("id").single()).data!.id;
  stats = (await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  await ingest(a, biology, "tests/fixtures/rag/biology_cells.pdf", "biology_cells.pdf");
  await ingest(a, biology, "tests/fixtures/rag/biology_errata.pdf", "biology_errata.pdf");
  await ingest(a, stats, "tests/fixtures/statistics_module_4.pdf", "statistics_module_4.pdf");
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const quantile = (xs: number[], q: number) => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(q * xs.length))] ?? 0;

describe("RAG quality", () => {
  it("retrieval, attribution, abstention, isolation, deletion and claim support", async () => {
    for (const c of gold.cases) {
      const t = performance.now();
      const res = await searchCourseMaterial(asServer(a.db), { courseId: biology, query: c.query, topK: 5 }, embedder);
      const ms = Math.round(performance.now() - t);
      const got = res.citations.map((x) => `${x.filename}#${x.pageStart}`);
      const relevant = new Set(c.relevant.map(([f, p]) => `${f}#${p}`));
      const topK = got.slice(0, K);
      if (c.type === "abstain") {
        rows.push({ id: c.id, type: c.type, query: c.query, retrieved: topK, firstRelevantRank: null, recall1: false, recallK: false, precisionK: null, requiredAll: null, abstained: res.abstained, correct: res.abstained, ms });
        continue;
      }
      const rank = got.findIndex((g) => relevant.has(g));
      const required = "required" in c && c.required ? (c.required as [string, number][]).map(([f, p]) => `${f}#${p}`) : null;
      const requiredAll = required ? required.every((r) => topK.includes(r)) : null;
      const recallK = rank >= 0 && rank < K;
      rows.push({
        id: c.id, type: c.type, query: c.query, retrieved: topK, firstRelevantRank: rank >= 0 ? rank + 1 : null, recall1: rank === 0, recallK,
        precisionK: topK.length ? topK.filter((g) => relevant.has(g)).length / topK.length : 0, requiredAll, abstained: res.abstained,
        correct: requiredAll ?? recallK, ms,
      });
    }

    // Cross-user isolation: student B asks about A's course id.
    const leak = await searchCourseMaterial(asServer(b.db), { courseId: biology, query: "mitochondria ATP glucose" }, embedder);
    checks.push({ name: "another student's course returns no passages", pass: leak.citations.length === 0, detail: `${leak.citations.length} passages` });

    // Deleted documents disappear from retrieval, chunks included.
    const tmpCourse = (await a.db.from("courses").insert({ title: "Temp" }).select("id").single()).data!.id;
    const docId = await ingest(a, tmpCourse, "tests/fixtures/rag/biology_cells.pdf", "to_delete.pdf");
    const before = await searchCourseMaterial(asServer(a.db), { courseId: tmpCourse, query: "phospholipid bilayer membrane" }, embedder);
    const { data: doc } = await a.db.from("documents").select("storage_path").eq("id", docId).single();
    await a.db.storage.from("course-documents").remove([doc!.storage_path!]);
    await a.db.from("documents").delete().eq("id", docId);
    const after = await searchCourseMaterial(asServer(a.db), { courseId: tmpCourse, query: "phospholipid bilayer membrane" }, embedder);
    const { count: chunks } = await admin().from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", docId);
    const { data: files } = await admin().storage.from("course-documents").list(`${a.id}/${tmpCourse}`);
    checks.push({ name: "deleted document: no passages, no chunks, no stored file", pass: before.citations.length > 0 && after.citations.length === 0 && chunks === 0 && (files ?? []).length === 0, detail: `before ${before.citations.length}, after ${after.citations.length}, chunks ${chunks}, files ${(files ?? []).length}` });

    // Claim-support checker vs labels.
    const passages = claims.passages as Record<string, string>;
    const scored = claims.claims.map((c) => ({ ...c, predicted: claimSupport(c.claim, [passages[c.passage]]).supported }));
    const tp = scored.filter((c) => c.label && c.predicted).length;
    const fp = scored.filter((c) => !c.label && c.predicted).length;
    const fn = scored.filter((c) => c.label && !c.predicted).length;
    const tn = scored.filter((c) => !c.label && !c.predicted).length;

    const answerable = rows.filter((r) => r.type !== "abstain");
    const abstain = rows.filter((r) => r.type === "abstain");
    const single = answerable.filter((r) => r.requiredAll === null);
    const metrics = {
      ranAt: new Date().toISOString(),
      retrievalMode: embedder ? `hybrid (${embedder.model})` : "lexical only (no embedding key)",
      k: K,
      evidenceThreshold: EVIDENCE_THRESHOLD,
      cases: rows.length,
      recallAt1: pct(single.filter((r) => r.recall1).length, single.length),
      recallAtK: pct(single.filter((r) => r.recallK).length, single.length),
      precisionAtK: Math.round((answerable.reduce((s, r) => s + (r.precisionK ?? 0), 0) / answerable.length) * 1000) / 1000,
      mrr: Math.round((single.reduce((s, r) => s + (r.firstRelevantRank ? 1 / r.firstRelevantRank : 0), 0) / single.length) * 1000) / 1000,
      multiPageAndConflictAllRequiredInTopK: `${answerable.filter((r) => r.requiredAll).length}/${answerable.filter((r) => r.requiredAll !== null).length}`,
      abstentionAccuracy: `${abstain.filter((r) => r.abstained).length}/${abstain.length}`,
      falseAbstentions: answerable.filter((r) => r.abstained).map((r) => r.id),
      latencyMs: { p50: quantile(rows.map((r) => r.ms), 0.5), p95: quantile(rows.map((r) => r.ms), 0.95) },
      tokensAndCost: embedder ? "query embedding per search (see embedding provider pricing)" : "0 tokens, $0 (lexical retrieval runs in Postgres)",
      claimChecker: { threshold: SUPPORT_THRESHOLD, labelled: scored.length, tp, fp, fn, tn, precision: Math.round((tp / (tp + fp)) * 1000) / 1000, recall: Math.round((tp / (tp + fn)) * 1000) / 1000, falseAccepts: scored.filter((c) => !c.label && c.predicted).map((c) => c.id) },
      checks,
    };
    writeFileSync("evals/results/rag-latest.json", JSON.stringify({ metrics, rows }, null, 2));
    writeFileSync(
      "evals/RAG_REPORT.md",
      [
        "# RAG evaluation (generated)",
        "",
        `Generated by \`npm run eval\` at ${metrics.ranAt}. Retrieval: ${metrics.retrievalMode}. k = ${K}. Fixtures: tests/fixtures/rag (synthetic).`,
        "",
        "| Metric | Value |",
        "| --- | --- |",
        `| Recall@1 (single-answer cases) | ${metrics.recallAt1}% |`,
        `| Recall@${K} (single-answer cases) | ${metrics.recallAtK}% |`,
        `| Precision@${K} (answerable cases) | ${metrics.precisionAtK} |`,
        `| MRR | ${metrics.mrr} |`,
        `| Multi-page / conflicting: all required pages in top ${K} | ${metrics.multiPageAndConflictAllRequiredInTopK} |`,
        `| Abstention when nothing supports an answer | ${metrics.abstentionAccuracy} |`,
        `| False abstentions | ${metrics.falseAbstentions.join(", ") || "none"} |`,
        `| Latency p50 / p95 | ${metrics.latencyMs.p50} / ${metrics.latencyMs.p95} ms |`,
        `| Tokens and cost | ${metrics.tokensAndCost} |`,
        `| Claim checker (threshold ${SUPPORT_THRESHOLD}) | precision ${metrics.claimChecker.precision}, recall ${metrics.claimChecker.recall} on ${scored.length} labelled claims; false accepts: ${metrics.claimChecker.falseAccepts.join(", ") || "none"} |`,
        ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "**FAIL**"} (${c.detail}) |`),
        "",
        "| ID | Type | Query | Top results | First relevant rank | Correct |",
        "| --- | --- | --- | --- | --- | --- |",
        ...rows.map((r) => `| ${r.id} | ${r.type} | ${r.query} | ${r.retrieved.join(", ") || "(abstained)"} | ${r.firstRelevantRank ?? "—"} | ${r.correct ? "yes" : "**no**"} |`),
        "",
      ].join("\n"),
    );
    // Hard gates: isolation and deletion must hold; quality numbers are reported, not asserted.
    expect(checks.filter((c) => !c.pass)).toEqual([]);
  });
});
