import { describe, expect, it } from "vitest";
import { createAnswerStreamer, type AnswerStreamEvent } from "@/lib/agents/recovery-agent";

const snippet = "A residual equals observed Y minus predicted Y_hat. Large residuals suggest poor fit for a particular observation.";
const sources = new Map([["S1", { sourceId: "S1", chunkId: "c1", documentId: "d1", filename: "module4.pdf", pageStart: 2, pageEnd: 2, snippet, score: 1, lexicalRank: 1, lexicalCoverage: 1, vectorSimilarity: null }]]);
const final = JSON.stringify({
  facts: [
    { statement: "A residual is observed Y minus predicted Y_hat.", sourceIds: ["S1"] },
    { statement: "Residuals measure the student's motivation level.", sourceIds: ["S1"] },
    { statement: "Invented fact citing a source never retrieved.", sourceIds: ["S7"] },
  ],
  suggestions: ["Start with the worksheet tonight.", "Then review residual plots."],
  clarifyingQuestion: null,
});

function streamInPieces(size: number) {
  const events: AnswerStreamEvent[] = [];
  const s = createAnswerStreamer(sources, (e) => events.push(e), { minTextGrowthChars: 0 });
  for (let i = 0; i < final.length; i += size) s.push(final.slice(i, i + size));
  return events;
}

describe("answer streamer", () => {
  it("emits only facts that pass the same citation check as the final answer, with their page", () => {
    const facts = streamInPieces(7).filter((e) => e.type === "fact");
    expect(facts).toEqual([
      { type: "fact", fact: { statement: "A residual is observed Y minus predicted Y_hat.", sourceIds: ["S1"] }, citations: [{ sourceId: "S1", documentId: "d1", filename: "module4.pdf", page: 2, chunkId: "c1" }] },
    ]);
  });

  it("streams suggestions word by word and ends on the full text", () => {
    const texts = streamInPieces(5).filter((e): e is Extract<AnswerStreamEvent, { type: "text" }> => e.type === "text");
    expect(texts.length).toBeGreaterThan(5);
    expect(texts.at(-1)!.suggestions).toEqual(["Start with the worksheet tonight.", "Then review residual plots."]);
    // Text only ever grows between events.
    for (let i = 1; i < texts.length; i++) expect(texts[i].suggestions.join("|").length).toBeGreaterThanOrEqual(texts[i - 1].suggestions.join("|").length);
  });

  it("resets when a new model turn starts after text was shown", () => {
    const events: AnswerStreamEvent[] = [];
    const s = createAnswerStreamer(sources, (e) => events.push(e), { minTextGrowthChars: 0 });
    s.reset(); // nothing shown yet: no reset event
    s.push('{"facts":[],"suggestions":["Draft');
    s.reset();
    expect(events.map((e) => e.type)).toEqual(["text", "reset"]);
  });

  it("throttles text updates by growth but never drops facts or the end of a suggestion", () => {
    const events: AnswerStreamEvent[] = [];
    const s = createAnswerStreamer(sources, (e) => events.push(e), { minTextGrowthChars: 20 });
    let pushes = 0;
    for (let i = 0; i < final.length; i += 2, pushes++) s.push(final.slice(i, i + 2));
    const texts = events.filter((e): e is Extract<AnswerStreamEvent, { type: "text" }> => e.type === "text");
    expect(texts.length).toBeLessThan(pushes / 4);
    expect(texts.at(-1)!.suggestions).toEqual(["Start with the worksheet tonight.", "Then review residual plots."]);
    expect(events.filter((e) => e.type === "fact")).toHaveLength(1);
  });
});
