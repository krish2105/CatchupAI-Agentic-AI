import type { Embedder } from "@/lib/rag/embed";

/** Deterministic hashed bag-of-words embedder for tests (no network). Not semantically meaningful. */
export const fakeEmbedder: Embedder = {
  model: "test-hash-embedder",
  async embed(texts) {
    return texts.map((text) => {
      const v = new Array(1536).fill(0);
      for (const word of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
        let h = 2166136261;
        for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        v[Math.abs(h) % 1536] += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  },
};
