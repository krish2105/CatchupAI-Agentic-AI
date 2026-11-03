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
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
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
