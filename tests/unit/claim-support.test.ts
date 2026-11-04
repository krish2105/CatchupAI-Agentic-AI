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

  it("rejects a swapped opposite word with otherwise the same words (C20, C25-C28)", () => {
    for (const id of ["C20", "C25", "C26", "C27", "C28"]) expect(scored.find((c) => c.id === id)!.predicted, id).toBe(false);
    expect(claimSupport("Meiosis produces gametes with double the chromosome number.", [passages.bio4]).reason).toBe('the passage says "half", not "double"');
  });

  it("has no false accepts on the labelled set", () => {
    expect(scored.filter((c) => !c.label && c.predicted).map((c) => c.id)).toEqual([]);
  });

  it("compares opposite words only against the best-matching sentence", () => {
    // bio4 says "identical" about mitosis and "different" about meiosis: each claim is judged by its own sentence.
    expect(claimSupport("Mitosis produces two genetically identical daughter cells.", [passages.bio4]).supported).toBe(true);
    expect(claimSupport("Meiosis produces four genetically different gametes.", [passages.bio4]).supported).toBe(true);
    // A sentence that uses both words of a pair doesn't count as contradicting either.
    const both = "Exercise can increase or decrease resting heart rate depending on intensity.";
    expect(claimSupport("Exercise can increase resting heart rate.", [both]).supported).toBe(true);
  });

  it("matches word forms of the same opposite pair", () => {
    const passage = "Adding a catalyst lowers the activation energy, so the reaction rate increases.";
    expect(claimSupport("Adding a catalyst raises the activation energy.", [passage]).supported).toBe(false);
    expect(claimSupport("Adding a catalyst decreases the reaction rate.", [passage]).supported).toBe(false);
    expect(claimSupport("A catalyst increases the reaction rate.", [passage]).supported).toBe(true);
  });

  it("treats uncheckable claims as unsupported", () => {
    expect(claimSupport("Yes.", ["anything at all here"]).supported).toBe(false);
  });
});
