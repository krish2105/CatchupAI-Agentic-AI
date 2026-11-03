import "server-only";
import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1536;

export type Embedder = { model: string; embed(texts: string[]): Promise<number[][]> };

/** OpenAI embeddings when a key is configured; otherwise null (retrieval falls back to lexical search). */
export function getEmbedder(): Embedder | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 });
  return {
    model,
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 64) {
        const res = await client.embeddings.create({ model, input: texts.slice(i, i + 64), dimensions: EMBEDDING_DIMENSIONS });
        out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
      }
      return out;
    },
  };
}

export function toPgVector(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS || values.some((v) => !Number.isFinite(v))) throw new RangeError("Invalid embedding");
  return `[${values.join(",")}]`;
}
