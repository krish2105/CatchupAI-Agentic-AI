import { describe, expect, it } from "vitest";
import { buildLesson } from "@/lib/catchup/lesson";
import { parseVoiceAnswer } from "@/lib/mastery/voice";

const pack = {
  summary: [
    { text: "Regression models the relationship between two variables.", page: 1 },
    { text: "A residual is the difference between an observed and a predicted value.", page: 2 },
    { text: "R squared measures how much variation the model explains.", page: 3 },
  ],
  keyTerms: [
    { term: "residual", page: 2, quote: "A residual is the difference between an observed and a predicted value." },
    { term: "slope", page: 2, quote: "The slope tells how much y changes when x increases by one." },
  ],
};

describe("two-voice lesson (Listen mode)", () => {
  it("alternates a host and a tutor, and every tutor line is a sentence from the lecture with its page", () => {
    const lines = buildLesson(pack, "regression_lecture.pdf");
    expect(lines[0]).toMatchObject({ speaker: "host", page: null });
    expect(lines[0].text).toContain("regression lecture");
    const lectureSentences = new Set([...pack.summary.map((s) => s.text), ...pack.keyTerms.map((t) => t.quote)]);
    for (const line of lines.filter((l) => l.speaker === "tutor")) {
      expect(lectureSentences.has(line.text)).toBe(true);
      expect(line.page).toBeGreaterThan(0);
    }
    expect(lines.at(-1)!.text).toMatch(/warm-up/);
  });

  it("never repeats the same sentence", () => {
    const tutor = buildLesson(pack, "x.pdf").filter((l) => l.speaker === "tutor").map((l) => l.text);
    expect(new Set(tutor).size).toBe(tutor.length);
  });
});

describe("voice answers", () => {
  const options = ["The slope of the line", "The difference between observed and predicted", "The sample mean", "The intercept"];
  it("understands a letter, an ordinal or the option's words, and a spoken confidence", () => {
    expect(parseVoiceAnswer("B", options)).toEqual({ chosen: 1, confidence: null });
    expect(parseVoiceAnswer("option c, I'm sure", options)).toEqual({ chosen: 2, confidence: "sure" });
    expect(parseVoiceAnswer("the first one, just guessing", options)).toEqual({ chosen: 0, confidence: "guess" });
    expect(parseVoiceAnswer("I think it's the difference between observed and predicted", options)).toEqual({ chosen: 1, confidence: "think" });
  });

  it("returns no choice when it can't tell", () => {
    expect(parseVoiceAnswer("hmm", options)).toEqual({ chosen: null, confidence: null });
  });
});
