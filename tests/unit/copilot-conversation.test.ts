import { describe, expect, it } from "vitest";
import { createAnswerStreamer, AgentAnswer, type AnswerStreamEvent } from "@/lib/agents/recovery-agent";
import { historyPreamble, HISTORY_LIMITS } from "@/lib/agents/history";
import { enforceScope, OUT_OF_SCOPE_REPLY, sanitizeFollowUps } from "@/lib/agents/scope";
import { parsePartialAnswer } from "@/lib/agents/partial-answer";
import { bestWindow } from "@/lib/rag/best-window";

const turn = (request: string, suggestions: string[] = [], facts: { statement: string; sourceIds: string[] }[] = []) => ({
  request,
  answer: { scope: "catchup" as const, facts, suggestions, clarifyingQuestion: null, followUps: [] },
});

describe("conversation history", () => {
  it("is empty for a new conversation", () => {
    expect(historyPreamble([])).toBe("");
  });

  it("gives the model earlier turns as context, without the old source ids", () => {
    const text = historyPreamble([turn("When is my worksheet due?", ["Start the worksheet today."], [{ statement: "Residuals are observed minus predicted values.", sourceIds: ["S1"] }])]);
    expect(text).toContain("Student: When is my worksheet due?");
    expect(text).toContain("Residuals are observed minus predicted values.");
    expect(text).toContain("Start the worksheet today.");
    expect(text).not.toContain("S1");
    expect(text).toMatch(/context only/i);
  });

  it("keeps the newest turns when the history is too long", () => {
    const long = (i: number) => turn(`Question ${i} ${"x".repeat(900)}`, [`Answer ${i}`]);
    const text = historyPreamble([1, 2, 3, 4, 5, 6].map(long));
    expect(text.length).toBeLessThanOrEqual(HISTORY_LIMITS.maxChars + 200);
    expect(text).toContain("Question 6");
    expect(text).not.toContain("Question 1 ");
  });
});

describe("staying on topic", () => {
  it("replaces an out-of-scope answer with a fixed redirect", () => {
    const out = enforceScope({ scope: "out_of_scope", facts: [{ statement: "Paris is the capital of France.", sourceIds: [] }], suggestions: ["Roses are red…"], clarifyingQuestion: "Want another?", followUps: ["Tell me a joke"] });
    expect(out).toEqual({ scope: "out_of_scope", facts: [], suggestions: [OUT_OF_SCOPE_REPLY], clarifyingQuestion: null, followUps: [] });
  });

  it("keeps in-scope answers and tidies their follow-up questions", () => {
    const a = { scope: "catchup" as const, facts: [], suggestions: ["Start with chapter 4."], clarifyingQuestion: null, followUps: [] };
    expect(enforceScope(a)).toEqual(a);
    expect(sanitizeFollowUps(["  Which pages cover residuals? ", "", "Which pages cover residuals?", "x".repeat(200), "Draft a plan for the worksheet", "What is due this week?"])).toEqual([
      "Which pages cover residuals?",
      "Draft a plan for the worksheet",
      "What is due this week?",
    ]);
  });

  it("reads answers stored before the upgrade as in scope with no follow-ups", () => {
    expect(AgentAnswer.parse({ facts: [], suggestions: ["x"], clarifyingQuestion: null })).toMatchObject({ scope: "catchup", followUps: [] });
  });

  it("never streams an answer the model marks as out of scope", () => {
    const events: AnswerStreamEvent[] = [];
    const streamer = createAnswerStreamer(new Map(), (e) => events.push(e), { minTextGrowthChars: 1 });
    streamer.push('{"scope":"out_of_scope","facts":[],"suggestions":["Roses are red, violets are blue');
    expect(events).toEqual([]);
    expect(parsePartialAnswer('{"scope":"catchup","facts":[]')?.scope).toBe("catchup");
  });

  it("still streams in-scope advice word by word", () => {
    const events: AnswerStreamEvent[] = [];
    const streamer = createAnswerStreamer(new Map(), (e) => events.push(e), { minTextGrowthChars: 1 });
    streamer.push('{"scope":"catchup","facts":[],"suggestions":["Start with the worksheet');
    expect(events.at(-1)).toMatchObject({ type: "text", suggestions: ["Start with the worksheet"] });
  });
});

describe("best passage window", () => {
  const filler = (n: number) => "Background sentence about something else entirely. ".repeat(n);

  it("returns short passages unchanged", () => {
    expect(bestWindow("Residuals measure error.", "residuals", 700)).toBe("Residuals measure error.");
  });

  it("shows the part of a long passage that matches the question, not just its start", () => {
    const text = `${filler(20)}A residual is the observed value minus the predicted value; plotting residuals reveals patterns. ${filler(20)}`;
    const window = bestWindow(text, "what is a residual plot", 300);
    expect(window).toContain("A residual is the observed value minus the predicted value");
    expect(window.length).toBeLessThanOrEqual(302);
    expect(window.startsWith("…")).toBe(true);
  });

  it("falls back to the start when nothing matches", () => {
    const text = filler(40);
    expect(bestWindow(text, "photosynthesis", 300).startsWith("Background sentence")).toBe(true);
  });
});
