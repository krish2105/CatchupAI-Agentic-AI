import { describe, expect, it } from "vitest";
import { createAnswerStreamer, judgeAnswer, verifyAnswer, type AnswerStreamEvent } from "@/lib/agents/recovery-agent";
import { VerdictCache, type JudgeClient } from "@/lib/rag/faithfulness-judge";

const snippet = "Meiosis instead produces four genetically different gametes with half the chromosome number. Mitosis produces two identical daughter cells.";
const sources = new Map([["S1", { sourceId: "S1", chunkId: "c1", documentId: "d1", filename: "bio.pdf", pageStart: 4, pageEnd: 4, snippet, score: 1, lexicalRank: 1, lexicalCoverage: 1, vectorSimilarity: null }]]);
// What list_assignments returned in the same run: the uncited deadline fact is grounded in it.
const toolData = [JSON.stringify([{ title: "Cell division essay", dueAt: "2026-11-13T12:00:00.000Z", estimatedMinutes: 90 }])];
const answer = {
  facts: [
    { statement: "Meiosis produces four genetically different gametes.", sourceIds: ["S1"] },
    { statement: "Mitosis produces two identical daughter cells.", sourceIds: ["S1"] },
    { statement: "Your assignment is due on Friday.", sourceIds: [] },
  ],
  suggestions: ["Draw both divisions side by side."],
  clarifyingQuestion: null,
};

/** Fake judge that rejects any claim mentioning "Mitosis"; can be told to fail. */
function judge(opts: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const client: JudgeClient = {
    model: "fake-judge",
    async complete(_s, user) {
      calls.push(user);
      if (opts.fail) throw new Error("quota");
      const items = [...user.matchAll(/<item id="([^"]+)">\nClaim: ([^\n]*)/g)];
      return { text: JSON.stringify({ verdicts: items.map((m) => ({ id: m[1], supported: !/Mitosis/.test(m[2]), reason: "fake" })) }), usage: { inputTokens: 50, outputTokens: 10 } };
    },
  };
  return { judge: { client, cache: new VerdictCache() }, calls };
}

describe("faithfulness judge in the copilot", () => {
  it("removes cited facts the judge rejects, keeps tool facts, and recomputes citations", async () => {
    const { judge: j, calls } = judge();
    const verified = verifyAnswer(answer, sources, toolData);
    expect(verified.answer.facts).toHaveLength(3);
    const out = await judgeAnswer(verified, sources, j);
    expect(calls).toHaveLength(1);
    // Only facts with source ids are sent to the judge.
    expect(calls[0]).not.toContain("assignment is due");
    expect(out.verified.answer.facts.map((f) => f.statement)).toEqual(["Meiosis produces four genetically different gametes.", "Your assignment is due on Friday."]);
    expect(out.verified.removed).toBe(1);
    expect(out.verified.citations.map((c) => c.sourceId)).toEqual(["S1"]);
    expect(out.judge).toMatchObject({ model: "fake-judge", checked: 2, removed: 1, failed: 0, usage: { inputTokens: 50, outputTokens: 10 } });
  });

  it("keeps the word check's result when the judge fails", async () => {
    const verified = verifyAnswer(answer, sources, toolData);
    const out = await judgeAnswer(verified, sources, judge({ fail: true }).judge);
    expect(out.verified.answer.facts).toHaveLength(3);
    expect(out.judge).toMatchObject({ checked: 2, removed: 0, failed: 2 });
  });

  it("does nothing without a judge or without cited facts", async () => {
    const verified = verifyAnswer(answer, sources, toolData);
    expect((await judgeAnswer(verified, sources, null)).judge).toBeNull();
    const toolOnly = verifyAnswer({ ...answer, facts: [answer.facts[2]] }, sources, toolData);
    const { judge: j, calls } = judge();
    expect((await judgeAnswer(toolOnly, sources, j)).judge).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("holds facts back from the live stream while a judge will still check them", () => {
    const events: AnswerStreamEvent[] = [];
    const s = createAnswerStreamer(sources, (e) => events.push(e), { minTextGrowthChars: 0, holdFacts: true });
    s.push(JSON.stringify(answer));
    expect(events.some((e) => e.type === "fact")).toBe(false);
    expect(events.some((e) => e.type === "text")).toBe(true);
  });
});
