import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS, fitDimensions, getEmbedder } from "@/lib/rag/embed";
import { vectorThreshold } from "@/lib/rag/retrieve";

afterEach(() => vi.unstubAllEnvs());

describe("embeddings", () => {
  it("cuts longer (Matryoshka) vectors to 1536 values and re-normalises them", () => {
    const long = Array.from({ length: 3072 }, (_, i) => (i % 7) - 3);
    const fitted = fitDimensions(long);
    expect(fitted).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...fitted)).toBeCloseTo(1, 6);
    expect(() => fitDimensions([1, 2, 3])).toThrow(RangeError);
  });

  it("picks the provider from the configured keys", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getEmbedder()).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "test-gemini");
    expect(getEmbedder()).toMatchObject({ provider: "gemini", model: "gemini-embedding-001" });
    // An OpenAI key alone doesn't move embeddings off Gemini (the chat model still runs on Gemini): see ADR-084.
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
    expect(getEmbedder()?.provider).toBe("gemini");
    // Once OpenAI is the chat provider (key and model), embeddings follow it.
    vi.stubEnv("OPENAI_MODEL", "test-model");
    expect(getEmbedder()?.provider).toBe("openai");
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(getEmbedder()?.provider).toBe("gemini");
  });

  it("uses a stricter similarity bar for Gemini, overridable by env", () => {
    expect(vectorThreshold(null)).toBe(0.3);
    expect(vectorThreshold({ provider: "gemini", model: "m", embed: async () => [] })).toBe(0.6);
    vi.stubEnv("EVIDENCE_VECTOR_THRESHOLD", "0.5");
    expect(vectorThreshold(null)).toBe(0.5);
  });
});

describe("embeddings in local test runs", () => {
  it("are off when the scripted test model is on against a local stack, even with a real key in .env.local", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-not-real");
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
    expect(getEmbedder()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co"); // never applies to a deployment
    expect(getEmbedder()).not.toBeNull();
    vi.unstubAllEnvs();
  });
});
