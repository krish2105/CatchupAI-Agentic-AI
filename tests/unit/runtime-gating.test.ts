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

  it("prefers a configured OpenAI model, which needs both key and model", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    expect(runtimeInfo().kind).toBe("none");
    vi.stubEnv("OPENAI_MODEL", "some-model");
    expect(runtimeInfo()).toEqual({ kind: "openai", model: "some-model" });
  });
});

describe("verifyAnswer", () => {
  it("drops facts citing sources that were never retrieved", () => {
    const sources = new Map([["S1", { sourceId: "S1", chunkId: "c", documentId: "d", filename: "f.pdf", pageStart: 2, pageEnd: 2, snippet: "", score: 1, lexicalRank: 1, lexicalCoverage: 1, vectorSimilarity: null }]]);
    const { answer, citations, removed } = verifyAnswer(
      { facts: [{ statement: "ok", sourceIds: ["S1"] }, { statement: "made up", sourceIds: ["S2"] }, { statement: "tool fact", sourceIds: [] }], suggestions: [], clarifyingQuestion: null },
      sources,
    );
    expect(answer.facts.map((f) => f.statement)).toEqual(["ok", "tool fact"]);
    expect(citations.map((c) => c.sourceId)).toEqual(["S1"]);
    expect(removed).toBe(1);
  });
});
