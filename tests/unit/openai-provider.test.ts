import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRecoveryAgent, classifyRunError, modelRuntime } from "@/lib/agents/recovery-agent";
import { supportsTemperature } from "@/lib/rag/faithfulness-judge";
import { embeddingProvider } from "@/lib/rag/embed";
import { aiProcessors } from "@/lib/ai/providers";

afterEach(() => vi.unstubAllEnvs());

describe("embeddingProvider: one embedding space, chosen on purpose", () => {
  it("follows the chat provider when nothing is set explicitly", () => {
    expect(embeddingProvider({ GEMINI_API_KEY: "g" })).toBe("gemini");
    expect(embeddingProvider({ OPENAI_API_KEY: "o", OPENAI_MODEL: "m" })).toBe("openai");
    expect(embeddingProvider({ OPENAI_API_KEY: "o" })).toBe("openai");
  });

  it("no longer switches embeddings to OpenAI just because an OpenAI key appears next to Gemini", () => {
    // Chat stays on Gemini here (no OPENAI_MODEL), so embeddings must too: mixing vector spaces breaks search.
    expect(embeddingProvider({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" })).toBe("gemini");
  });

  it("honours AI_PROVIDER (any case) and lets EMBEDDING_PROVIDER keep the existing vectors", () => {
    expect(embeddingProvider({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", OPENAI_MODEL: "m", AI_PROVIDER: " OpenAI " })).toBe("openai");
    expect(embeddingProvider({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", OPENAI_MODEL: "m", AI_PROVIDER: "gemini" })).toBe("gemini");
    expect(embeddingProvider({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", OPENAI_MODEL: "m", AI_PROVIDER: "openai", EMBEDDING_PROVIDER: "gemini" })).toBe("gemini");
  });

  it("returns none rather than silently using the other provider when the chosen one has no key", () => {
    expect(embeddingProvider({ OPENAI_API_KEY: "o", EMBEDDING_PROVIDER: "gemini" })).toBeNull();
    expect(embeddingProvider({})).toBeNull();
  });
});

describe("OpenAI runtime", () => {
  it("doesn't store responses at OpenAI, and passes an optional reasoning effort", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "gpt-test");
    vi.stubEnv("OPENAI_FALLBACK_MODEL", "gpt-test-mini");
    vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    const runtime = modelRuntime()!;
    expect(runtime).toMatchObject({ kind: "openai", model: "gpt-test", settings: { store: false, reasoning: { effort: "low" } } });
    expect(runtime.fallback).toMatchObject({ model: "gpt-test-mini", settings: { store: false } });
    expect(buildRecoveryAgent(runtime.model, runtime.settings).modelSettings).toMatchObject({ parallelToolCalls: false, store: false });
  });

  it("leaves Gemini's settings as they were", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "g-test-not-real");
    const runtime = modelRuntime()!;
    expect(runtime.kind).toBe("gemini");
    expect(runtime.settings).toBeUndefined();
    expect(buildRecoveryAgent(runtime.model, runtime.settings).modelSettings).toEqual({ parallelToolCalls: false });
  });

  it("recognises OpenAI's quota error as a quota problem (eligible for the fallback model)", () => {
    expect(classifyRunError({ status: 429, code: "insufficient_quota", message: "You exceeded your current quota" })).toBe("model_quota");
    expect(classifyRunError({ status: 429, message: "Rate limit reached for requests" })).toBe("model_busy");
    expect(classifyRunError({ status: 429, message: "Quota exceeded: GenerateRequestsPerDayPerProjectPerModel" })).toBe("model_quota");
  });
});

describe("aiProcessors (what the privacy notice names)", () => {
  it("names OpenAI when it runs the copilot or the embeddings, and Gemini when it still runs anything", () => {
    expect(aiProcessors({ OPENAI_API_KEY: "o", OPENAI_MODEL: "m", AI_PROVIDER: "openai" })).toEqual({ openai: true, gemini: false });
    expect(aiProcessors({ GEMINI_API_KEY: "g", AI_PROVIDER: "gemini" })).toEqual({ openai: false, gemini: true });
    // Chat on OpenAI, Gemini kept for embeddings and scanned-PDF reading: both are processors.
    expect(aiProcessors({ OPENAI_API_KEY: "o", OPENAI_MODEL: "m", GEMINI_API_KEY: "g", AI_PROVIDER: "openai", EMBEDDING_PROVIDER: "gemini" })).toEqual({ openai: true, gemini: true });
    expect(aiProcessors({})).toEqual({ openai: false, gemini: false });
  });
});

describe("faithfulness judge", () => {
  it("sends temperature 0 only to models that accept it", () => {
    expect(supportsTemperature("gemini-3.6-flash", true)).toBe(true);
    expect(supportsTemperature("gpt-4.1-mini", false)).toBe(true);
    expect(supportsTemperature("gpt-5.6-luna", false)).toBe(false);
    expect(supportsTemperature("o4-mini", false)).toBe(false);
  });
});
