import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAnswer } from "@/lib/agents/recovery-agent";
import { runtimeInfo, scriptedRuntimeAllowed } from "@/lib/agents/runtime";

afterEach(() => vi.unstubAllEnvs());

describe("AI runtime selection", () => {
  it("never enables the scripted test model against a non-local Supabase", () => {
    vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    expect(scriptedRuntimeAllowed()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost.evil.example:54321");
    expect(scriptedRuntimeAllowed()).toBe(false);
  });

  it("requires the explicit flag even locally", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(runtimeInfo()).toEqual({ kind: "none" });
    vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
    expect(runtimeInfo()).toEqual({ kind: "scripted", model: "scripted-test-model" });
  });

  it("lets the explicit local test flag win over a real key, so tests never spend model quota", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "some-model");
    expect(runtimeInfo()).toEqual({ kind: "scripted", model: "scripted-test-model" });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    expect(runtimeInfo().kind).toBe("openai");
  });

  it("prefers a configured OpenAI model, which needs both key and model", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    expect(runtimeInfo().kind).toBe("none");
    vi.stubEnv("OPENAI_MODEL", "some-model");
    expect(runtimeInfo()).toEqual({ kind: "openai", model: "some-model" });
  });

  it("runs on OpenAI only: a leftover Gemini key or AI_PROVIDER setting selects nothing else", () => {
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "test-not-real");
    vi.stubEnv("GEMINI_MODEL", "old-model");
    expect(runtimeInfo()).toEqual({ kind: "none" });
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "some-model");
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(runtimeInfo()).toEqual({ kind: "openai", model: "some-model" });
  });
});

describe("verifyAnswer", () => {
  it("drops facts citing sources that were never retrieved, that the cited passage doesn't support, or that cite nothing and aren't in the tool results", () => {
    const snippet = "A residual equals observed Y minus predicted Y_hat. Large residuals suggest poor fit for a particular observation.";
    const sources = new Map([["S1", { sourceId: "S1", chunkId: "c", documentId: "d", filename: "f.pdf", pageStart: 2, pageEnd: 2, snippet, score: 1, lexicalRank: 1, lexicalCoverage: 1, vectorSimilarity: null }]]);
    const supported = "A residual is observed Y minus predicted Y_hat.";
    const { answer, citations, removed } = verifyAnswer(
      {
        facts: [
          { statement: supported, sourceIds: ["S1"] },
          { statement: "Residuals measure the student's motivation level.", sourceIds: ["S1"] },
          { statement: "made up", sourceIds: ["S2"] },
          { statement: "The regression worksheet is due on 10 November.", sourceIds: [] },
          { statement: "Residuals show how well the line fits.", sourceIds: [] },
        ],
        suggestions: [],
        clarifyingQuestion: null,
      },
      sources,
      [JSON.stringify([{ title: "Regression worksheet", dueAt: "2026-11-10T12:55:00.000Z", estimatedMinutes: 240 }])],
    );
    expect(answer.facts.map((f) => f.statement)).toEqual([supported, "The regression worksheet is due on 10 November."]);
    expect(citations.map((c) => c.sourceId)).toEqual(["S1"]);
    expect(removed).toBe(3);
  });
});
