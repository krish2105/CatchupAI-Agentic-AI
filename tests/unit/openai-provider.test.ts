import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRecoveryAgent, classifyRunError, modelRuntime } from "@/lib/agents/recovery-agent";
import { supportsTemperature } from "@/lib/rag/faithfulness-judge";
import { embeddingProvider } from "@/lib/rag/embed";
import { aiProcessors } from "@/lib/ai/providers";

afterEach(() => vi.unstubAllEnvs());

describe("embeddingProvider: OpenAI embeddings whenever an OpenAI key is set", () => {
  it("uses OpenAI with a key, and lexical search only without one", () => {
    expect(embeddingProvider({ OPENAI_API_KEY: "o", OPENAI_MODEL: "m" })).toBe("openai");
    expect(embeddingProvider({ OPENAI_API_KEY: "o" })).toBe("openai");
    expect(embeddingProvider({})).toBeNull();
  });

  it("ignores leftover Gemini settings", () => {
    expect(embeddingProvider({ GEMINI_API_KEY: "g" })).toBeNull();
    expect(embeddingProvider({ OPENAI_API_KEY: "o", EMBEDDING_PROVIDER: "gemini", AI_PROVIDER: "gemini" })).toBe("openai");
  });
});

describe("OpenAI runtime", () => {
  it("doesn't store responses at OpenAI, and passes an optional reasoning effort", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "gpt-test");
    vi.stubEnv("OPENAI_FALLBACK_MODEL", "gpt-test-mini");
    vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    const runtime = modelRuntime()!;
    expect(runtime).toMatchObject({ kind: "openai", model: "gpt-test", settings: { store: false, reasoning: { effort: "low" } } });
    expect(runtime.fallback).toMatchObject({ model: "gpt-test-mini", settings: { store: false } });
    expect(buildRecoveryAgent(runtime.model, runtime.settings).modelSettings).toMatchObject({ parallelToolCalls: false, store: false });
  });

  it("needs both a key and a model", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "");
    expect(modelRuntime()).toBeNull();
  });

  it("recognises OpenAI's quota error as a quota problem (eligible for the fallback model)", () => {
    expect(classifyRunError({ status: 429, code: "insufficient_quota", message: "You exceeded your current quota" })).toBe("model_quota");
    expect(classifyRunError({ status: 429, message: "Rate limit reached for requests" })).toBe("model_busy");
  });
});

describe("aiProcessors (what the privacy notice names)", () => {
  it("names OpenAI when it runs the copilot, the embeddings or scanned-PDF reading", () => {
    expect(aiProcessors({ OPENAI_API_KEY: "o", OPENAI_MODEL: "m" })).toEqual({ openai: true });
    expect(aiProcessors({ OPENAI_API_KEY: "o" })).toEqual({ openai: true });
    expect(aiProcessors({ GEMINI_API_KEY: "g" })).toEqual({ openai: false });
    expect(aiProcessors({})).toEqual({ openai: false });
  });
});

describe("faithfulness judge", () => {
  it("sends temperature 0 only to models that accept it", () => {
    expect(supportsTemperature("gpt-4.1-mini")).toBe(true);
    expect(supportsTemperature("gpt-5.6-luna")).toBe(false);
    expect(supportsTemperature("o4-mini")).toBe(false);
  });
});
