/**
 * Live streaming check: one real copilot run with the answer streamed (the same onAnswer callback the chat route turns
 * into SSE "answer" events). Records how many fact/text events arrived, when the first one came, and whether the
 * streamed facts match the final, checked answer. Live only: runs when STREAM_LIVE=1 and a model key is configured;
 * otherwise skipped (reported as not run). Writes evals/results/streaming-latest.json.
 *   STREAM_LIVE=1 npm run eval -- evals/streaming.eval.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { modelRuntime, runRecoveryAgent, streamingEnabled, type AnswerStreamEvent } from "@/lib/agents/recovery-agent";
import { getEmbedder } from "@/lib/rag/embed";
import { processDocument } from "@/lib/rag/ingest";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "../tests/integration/helpers";

const runtime = process.env.STREAM_LIVE === "1" ? modelRuntime() : null;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const asAdmin = () => admin() as unknown as AdminSupabase;
let userId: string | null = null;

afterAll(async () => {
  if (userId) await deleteUser(userId);
});

describe("live answer streaming", () => {
  it.skipIf(!runtime || !streamingEnabled())("streams checked facts and advice before the run finishes", async () => {
    const u = await signedInUser("stream-live");
    userId = u.id;
    const course = (await u.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id as string;
    const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
    const doc = await u.db.from("documents").insert({ course_id: course, filename: "statistics_module_4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
    await u.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
    const embedder = getEmbedder();
    await processDocument({ supabase: asServer(u.db), admin: asAdmin(), userId: u.id, documentId: doc.data!.id, embedder });

    const events: { at: number; type: AnswerStreamEvent["type"] }[] = [];
    const streamedFacts: string[] = [];
    const started = Date.now();
    const out = await runRecoveryAgent({
      supabase: asServer(u.db), admin: asAdmin(), userId: u.id, courseId: course, message: "Explain residuals from my course notes.", runtime: runtime!, embedder, now: Date.now(), judge: null,
      onAnswer: (e) => {
        events.push({ at: Date.now() - started, type: e.type });
        if (e.type === "reset") streamedFacts.length = 0;
        if (e.type === "fact") streamedFacts.push(e.fact.statement);
      },
    });
    const totalMs = Date.now() - started;
    const finalFacts = out.answer?.facts.map((f) => f.statement) ?? [];
    const result = {
      at: new Date().toISOString(),
      model: `${runtime!.kind}:${runtime!.model}`,
      status: out.status,
      errorCode: out.errorCode ?? null,
      totalMs,
      firstEventMs: events[0]?.at ?? null,
      events: { fact: events.filter((e) => e.type === "fact").length, text: events.filter((e) => e.type === "text").length, reset: events.filter((e) => e.type === "reset").length },
      tools: out.events.map((e) => e.tool),
      finalFacts: finalFacts.length,
      streamedFactsMatchFinal: JSON.stringify(streamedFacts) === JSON.stringify(finalFacts),
    };
    writeFileSync("evals/results/streaming-latest.json", `${JSON.stringify(result, null, 2)}\n`);
    expect(out.status).toBe("completed");
    expect(result.events.fact + result.events.text).toBeGreaterThan(0);
  });
});
