import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS, fitDimensions, getEmbedder } from "@/lib/rag/embed";
import { vectorThreshold } from "@/lib/rag/retrieve";

afterEach(() => vi.unstubAllEnvs());

describe("embeddings", () => {
  it("cuts longer vectors to 1536 values and re-normalises them", () => {
    const long = Array.from({ length: 3072 }, (_, i) => (i % 7) - 3);
    const fitted = fitDimensions(long);
    expect(fitted).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...fitted)).toBeCloseTo(1, 6);
    expect(() => fitDimensions([1, 2, 3])).toThrow(RangeError);
  });

  it("uses OpenAI's embedding model when an OpenAI key is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "");
    expect(getEmbedder()).toBeNull();
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
    expect(getEmbedder()).toMatchObject({ provider: "openai", model: "text-embedding-3-small" });
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large");
    expect(getEmbedder()?.model).toBe("text-embedding-3-large");
  });

  it("has one similarity bar, overridable by env", () => {
    expect(vectorThreshold(null)).toBe(0.3);
    expect(vectorThreshold({ provider: "openai", model: "m", embed: async () => [] })).toBe(0.3);
    vi.stubEnv("EVIDENCE_VECTOR_THRESHOLD", "0.5");
    expect(vectorThreshold(null)).toBe(0.5);
  });
});

describe("embeddings in local test runs", () => {
  it("are off when the scripted test model is on against a local stack, even with a real key in .env.local", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-not-real");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
    expect(getEmbedder()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co"); // never applies to a deployment
    expect(getEmbedder()).not.toBeNull();
    vi.unstubAllEnvs();
  });
});
