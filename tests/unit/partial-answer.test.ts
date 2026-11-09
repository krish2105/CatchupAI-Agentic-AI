import { describe, expect, it } from "vitest";
import { parsePartialAnswer } from "@/lib/agents/partial-answer";

const full = JSON.stringify({
  facts: [
    { statement: "A residual is observed Y minus predicted Y-hat.", sourceIds: ["S1"] },
    { statement: "The worksheet is due Friday.", sourceIds: [] },
  ],
  suggestions: ["Start with the worksheet.", "Review residuals \"first\" \\ then plots."],
  clarifyingQuestion: null,
});

describe("parsePartialAnswer (streamed structured answer)", () => {
  it("returns the whole answer once the JSON is complete", () => {
    expect(parsePartialAnswer(full)).toEqual({ ...JSON.parse(full), scope: null, midString: false }); // no scope key in this answer
  });

  it("never yields a fact that is still being written", () => {
    const mid = full.indexOf("observed") + 4;
    expect(parsePartialAnswer(full.slice(0, mid))).toEqual({ scope: null, facts: [], suggestions: [], clarifyingQuestion: null, midString: true });
    const closeFirst = full.indexOf("},");
    expect(parsePartialAnswer(full.slice(0, closeFirst))!.facts).toEqual([]); // its closing brace hasn't arrived
    expect(parsePartialAnswer(full.slice(0, closeFirst + 1))!.facts).toHaveLength(1);
    const inSecond = full.indexOf("due Friday");
    expect(parsePartialAnswer(full.slice(0, inSecond))!.facts.map((f) => f.sourceIds)).toEqual([["S1"]]);
  });

  it("shows suggestions word by word, including a half-written one", () => {
    const at = full.indexOf("the worksheet") + 7;
    expect(parsePartialAnswer(full.slice(0, at))).toMatchObject({ facts: JSON.parse(full).facts, suggestions: ["Start with the wor"], midString: true });
  });

  it("survives every possible cut point without throwing, and only grows", () => {
    let lastFacts = 0;
    for (let i = 0; i <= full.length; i++) {
      const p = parsePartialAnswer(full.slice(0, i));
      if (!p) continue;
      expect(p.facts.length).toBeGreaterThanOrEqual(lastFacts);
      lastFacts = p.facts.length;
      for (const f of p.facts) expect(JSON.parse(full).facts).toContainEqual(f);
    }
    expect(lastFacts).toBe(2);
  });

  it("handles escapes cut in half", () => {
    const at = full.indexOf("\\\\") + 1; // stops right after the first backslash of an escaped backslash
    const p = parsePartialAnswer(full.slice(0, at));
    expect(p!.suggestions.at(-1)).toBe('Review residuals "first" ');
  });

  it("ignores text that isn't a JSON object", () => {
    expect(parsePartialAnswer("Sure! Here is")).toBeNull();
    expect(parsePartialAnswer("")).toBeNull();
  });
});
