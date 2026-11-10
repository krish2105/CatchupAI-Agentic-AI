import { describe, expect, it } from "vitest";
import { REPLAYS, toReplay, type RawTrace } from "@/lib/quality/replay";
import history from "../../evals/results/live-history.json";

const base: RawTrace = {
  scenario: "S9-test",
  title: "A test case",
  model: "openai:gpt-5.4-mini",
  ranAt: "2026-11-08T09:49:35.251Z",
  request: "Plan my week",
  latencyMs: 8817,
  tokens: { input: 100, output: 20 },
  status: "completed",
  errorCode: null,
  steps: [
    { step: 2, tool: "draft_recovery_plan", args: { scenario: "balanced" }, status: "completed", ms: 56, outcome: "balanced draft" },
    { step: 1, tool: "list_assignments", args: {}, status: "completed", ms: 18, outcome: "2 assignments" },
  ],
  answer: { facts: [{ statement: "Due Tuesday.", sources: [] }, { statement: "A residual is Y minus Y hat.", sources: ["S1"] }], suggestions: ["Start early."] },
  citations: ["notes.pdf p. 2"],
  removedUnsupportedFacts: 2,
  draft: { status: "pending", feasible: false, shortfallMinutes: 360, savedWithoutApproval: false },
};

describe("recorded real runs (replay)", () => {
  it("orders steps, uses plain tool names and strips the provider prefix from the model", () => {
    const r = toReplay(base);
    expect(r.model).toBe("gpt-5.4-mini");
    expect(r.steps.map((s) => s.tool)).toEqual(["list_assignments", "draft_recovery_plan"]);
    expect(r.steps[0].label).toBe("Listed your assignments");
    expect(r.sourceUrl).toBe("https://github.com/krish2105/CatchupAI-Agentic-AI/blob/main/docs/evidence/agent-traces/S9-test.json");
  });

  it("says whether each kept fact was cited to course pages or backed by tool data", () => {
    const r = toReplay(base);
    expect(r.facts).toEqual([
      { statement: "Due Tuesday.", basis: "tool data" },
      { statement: "A residual is Y minus Y hat.", basis: "course pages" },
    ]);
    expect(r.removedFacts).toBe(2);
  });

  it("describes the draft honestly: pending, never saved, with the shortfall", () => {
    expect(toReplay(base).draft).toEqual({ feasible: false, shortfallMinutes: 360, saved: false });
    expect(toReplay({ ...base, draft: null }).draft).toBeNull();
  });

  it("shows a failed run as failed, with no answer", () => {
    const r = toReplay({ ...base, status: "failed", errorCode: "model_error", answer: null, steps: [] });
    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("model_error");
    expect(r.facts).toEqual([]);
    expect(r.suggestions).toEqual([]);
  });

  it("refuses scripted traces: a replay must come from a real model", () => {
    expect(() => toReplay({ ...base, model: "scripted" })).toThrow(/scripted/);
  });

  it("the committed replays are the latest real live runs of S1–S4, each matching the live history", () => {
    expect(REPLAYS.map((r) => r.id)).toEqual(["S1-missed-lecture", "S2-overloaded-week", "S3-poisoned-notes", "S4-safe-failure"]);
    for (const r of REPLAYS) {
      expect(r.model).not.toMatch(/scripted/);
      expect(Number.isNaN(Date.parse(r.recordedAt))).toBe(false);
      // The trace's own outcome must agree with the latest live result recorded for that case.
      const runs = (history as unknown as { runs: { cases: Record<string, string> }[] }).runs.filter((h) => h.cases[r.id]);
      expect(runs.length).toBeGreaterThan(0);
      expect(runs.at(-1)!.cases[r.id]).toBe("pass");
    }
  });
});

describe("live case titles on /quality", () => {
  it("every case title is complete: none ends with a dangling 'uses'", () => {
    for (const title of Object.values((history as unknown as { titles: Record<string, string> }).titles)) {
      expect(title.trim()).not.toMatch(/\buses$/);
    }
  });
});
