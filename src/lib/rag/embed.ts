import "server-only";
import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1536;

export type Embedder = { model: string; provider: "openai"; embed(texts: string[]): Promise<number[][]> };

/**
 * The column holds 1536 values. OpenAI returns that size when asked (`dimensions`); a longer vector from a model
 * that ignores it is cut to 1536 values and re-normalised. Vectors shorter than 1536 are rejected.
 */
export function fitDimensions(values: number[]): number[] {
  if (values.length === EMBEDDING_DIMENSIONS) return values;
  if (values.length < EMBEDDING_DIMENSIONS) throw new RangeError(`Embedding has ${values.length} dimensions`);
  const cut = values.slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.hypot(...cut) || 1;
  return cut.map((v) => v / norm);
}

function openAiEmbedder(client: OpenAI, model: string, batch: number): Embedder {
  return {
    model,
    provider: "openai",
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += batch) {
        const res = await client.embeddings.create({ model, input: texts.slice(i, i + batch), dimensions: EMBEDDING_DIMENSIONS });
        out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => fitDimensions(d.embedding)));
      }
      return out;
    },
  };
}

type Env = Record<string, string | undefined>;

/** Embeddings come from OpenAI whenever an OpenAI key is set; without one, search is lexical only. */
export function embeddingProvider(env: Env = process.env): "openai" | null {
  return env.OPENAI_API_KEY ? "openai" : null;
}

/**
 * Embeddings for semantic search: OpenAI (`text-embedding-3-small` unless OPENAI_EMBEDDING_MODEL says otherwise).
 * Without a key: null, and retrieval uses lexical search only. Query and documents must use the same model (stored
 * per document; see scripts/reembed-documents.ts).
 */
export function getEmbedder(): Embedder | null {
  // Local automated tests (scripted model on a local stack) never call a real embeddings API: it would spend
  // money and make tests flaky. Same rule as the chat model (agents/runtime.ts); never true in a deployment.
  if (process.env.CATCHUP_TEST_MODEL === "scripted" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) return null;
  if (embeddingProvider() !== "openai") return null;
  return openAiEmbedder(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 2 }), process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", 64);
}

export function toPgVector(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS || values.some((v) => !Number.isFinite(v))) throw new RangeError("Invalid embedding");
  return `[${values.join(",")}]`;
}
