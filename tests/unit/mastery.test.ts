import { describe, expect, it } from "vitest";
import { bridge, DIFFICULTY, expectedScore, pickNext, statusFor, updateRating } from "@/lib/mastery/elo";
import { clozeItem, validateItem, type ItemDraft } from "@/lib/mastery/items";

const fresh = { rating: 0, attempts: 0 };
const after = (outcome: { correct: boolean; confidence: "sure" | "think" | "guess" }) => updateRating(fresh, { difficulty: DIFFICULTY.medium }, outcome);
const status = (r: { rating: number; attempts: number }, correct: number, lastConfidentWrong = false) => statusFor({ ...r, correct, lastConfidentWrong });

describe("mastery ratings (Elo)", () => {
  it("expected score is 0.5 when the student's rating equals the question's difficulty", () => {
    expect(expectedScore(0, 0)).toBe(0.5);
    expect(expectedScore(1, 0)).toBeGreaterThan(0.5);
  });

  it("a sure, correct first answer marks the concept known; a guess only makes it shaky", () => {
    expect(status(after({ correct: true, confidence: "sure" }), 1)).toBe("known");
    expect(status(after({ correct: true, confidence: "think" }), 1)).toBe("shaky");
    expect(status(after({ correct: true, confidence: "guess" }), 1)).toBe("shaky");
  });

  it("a wrong answer marks it not yet, and a sure wrong answer marks it confidently wrong", () => {
    expect(status(after({ correct: false, confidence: "guess" }), 0)).toBe("not_yet");
    expect(status(after({ correct: false, confidence: "sure" }), 0, true)).toBe("confidently_wrong");
  });

  it("untested concepts stay untested, and steps get smaller as attempts grow", () => {
    expect(status(fresh, 0)).toBe("untested");
    const first = updateRating({ rating: 0, attempts: 0 }, { difficulty: 0 }, { correct: true, confidence: "think" });
    const later = updateRating({ rating: 0, attempts: 8 }, { difficulty: 0 }, { correct: true, confidence: "think" });
    expect(first.rating).toBeGreaterThan(later.rating);
    expect(later.attempts).toBe(9);
  });

  it("picks the question whose expected success is closest to the target", () => {
    // residuals at -0.4 on an easy item ≈ 0.52 (closest to 0.5); correlation at 1.2 on a hard item ≈ 0.67.
    const ratings = new Map([["residuals", -0.4], ["correlation", 1.2]]);
    const candidates = [
      { itemId: "a", concept: "correlation", difficulty: DIFFICULTY.hard },
      { itemId: "b", concept: "residuals", difficulty: DIFFICULTY.easy },
      { itemId: "c", concept: "residuals", difficulty: DIFFICULTY.hard },
    ];
    expect(pickNext(candidates, ratings, 0.5)).toBe("b");
    expect(pickNext([], ratings, 0.5)).toBeNull();
  });

  it("the bridge starts with confidently wrong concepts, then not yet, then shaky, and leaves known ones out", () => {
    const order = bridge([
      { concept: "a", status: "shaky" },
      { concept: "b", status: "known" },
      { concept: "c", status: "confidently_wrong" },
      { concept: "d", status: "not_yet" },
      { concept: "e", status: "untested" },
    ]);
    expect(order.map((c) => c.concept)).toEqual(["c", "d", "a", "e"]);
  });
});

const source = { concept: "residual", page: 3, quote: "A residual is the difference between an observed value and the value predicted by the regression line." };
const good: ItemDraft = {
  concept: "residual",
  prompt: "What is a residual in a regression?",
  options: ["The difference between an observed value and the predicted value", "The slope of the line", "The mean of x", "The sample size"],
  answerIndex: 0,
  page: 3,
  difficulty: "medium",
  hint: "Think about what the line predicts compared with what you observed.",
};

describe("question validation (every question must be backed by its page)", () => {
  it("accepts a question whose correct option is supported by the quoted page", () => {
    expect(validateItem(good, source)).toEqual({ ok: true });
  });

  it("rejects a question that cites a different page", () => {
    expect(validateItem({ ...good, page: 4 }, source)).toMatchObject({ ok: false, reason: "page" });
  });

  it("rejects duplicate or missing options and an out-of-range answer", () => {
    expect(validateItem({ ...good, options: ["A", "a", "B", "C"] }, source)).toMatchObject({ ok: false, reason: "options" });
    expect(validateItem({ ...good, options: ["A", "B", "C"] }, source)).toMatchObject({ ok: false, reason: "options" });
    expect(validateItem({ ...good, answerIndex: 4 }, source)).toMatchObject({ ok: false, reason: "answer" });
  });

  it("rejects a question whose 'correct' option the page doesn't support", () => {
    expect(validateItem({ ...good, options: ["The square root of the variance", "The slope of the line", "The mean of x", "The sample size"] }, source)).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("rejects a hint that gives the answer away", () => {
    expect(validateItem({ ...good, hint: "It is the difference between an observed value and the predicted value." }, source)).toMatchObject({ ok: false, reason: "hint" });
  });
});

describe("cloze fallback (no AI)", () => {
  it("blanks the concept in its quote and offers it among other key terms", () => {
    const item = clozeItem(source, ["slope", "intercept", "correlation", "variance"], "seed-1");
    expect(item).not.toBeNull();
    expect(item!.prompt).toContain("_____");
    expect(item!.prompt).not.toMatch(/\bresidual\b/i);
    expect(item!.options).toHaveLength(4);
    expect(item!.options[item!.answerIndex]).toBe("residual");
    expect(validateItem(item!, source)).toEqual({ ok: true });
  });

  it("returns null when there aren't enough other terms for distractors", () => {
    expect(clozeItem(source, ["slope"], "seed-1")).toBeNull();
  });
});
