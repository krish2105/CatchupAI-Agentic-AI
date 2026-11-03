import { describe, expect, it } from "vitest";
import data from "../../evals/rag/claims.json";
import { claimSupport } from "@/lib/rag/claim-support";

describe("claim-to-citation support", () => {
  const passages = data.passages as Record<string, string>;
  const scored = data.claims.map((c) => ({ ...c, predicted: claimSupport(c.claim, [passages[c.passage]]).supported }));

  it("accepts the labelled supported claims (paraphrase, quotes, numbers)", () => {
    const misses = scored.filter((c) => c.label && !c.predicted).map((c) => c.id);
    expect(misses).toEqual([]);
  });

  it("rejects wrong numbers, wrong pages, fabricated quotes and injected citations", () => {
    for (const id of ["C13", "C14", "C15", "C18", "C19", "C21"]) expect(scored.find((c) => c.id === id)!.predicted, id).toBe(false);
  });

  it("catches dropped negations and mostly-new wording", () => {
    expect(scored.find((c) => c.id === "C17")!.predicted).toBe(false);
    expect(scored.find((c) => c.id === "C16")!.predicted).toBe(false);
  });

  it("documents its known blind spot: a swapped detail with the same words (C20) still passes", () => {
    // Antonyms like "half" vs "double" aren't modelled; see RAG_QUALITY_REPORT.md.
    expect(scored.filter((c) => !c.label && c.predicted).map((c) => c.id)).toEqual(["C20"]);
  });

  it("treats uncheckable claims as unsupported", () => {
    expect(claimSupport("Yes.", ["anything at all here"]).supported).toBe(false);
  });
});
