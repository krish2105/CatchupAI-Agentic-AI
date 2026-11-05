import "server-only";
import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1536;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export type Embedder = { model: string; provider: "openai" | "gemini"; embed(texts: string[]): Promise<number[][]> };

/**
 * gemini-embedding-001 is trained so that a prefix of its vector is itself a valid embedding (Matryoshka), so a
 * longer vector is cut to 1536 values and re-normalised. Vectors shorter than 1536 are rejected.
 */
export function fitDimensions(values: number[]): number[] {
  if (values.length === EMBEDDING_DIMENSIONS) return values;
  if (values.length < EMBEDDING_DIMENSIONS) throw new RangeError(`Embedding has ${values.length} dimensions`);
  const cut = values.slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.hypot(...cut) || 1;
  return cut.map((v) => v / norm);
}

function openAiCompatible(provider: Embedder["provider"], client: OpenAI, model: string, batch: number): Embedder {
  return {
    model,
    provider,
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

/**
 * Embeddings for semantic search: OpenAI (`text-embedding-3-small`) or Gemini (`gemini-embedding-001`) through its
 * OpenAI-compatible endpoint. AI_PROVIDER=gemini prefers Gemini when both keys exist. Without a key: null, and
 * retrieval uses lexical search only. Query and documents must use the same provider (stored per document).
 */
export function getEmbedder(): Embedder | null {
  // Local automated tests (scripted model on a local stack) never call a real embeddings API: it would spend
  // the free quota and make tests flaky. Same rule as the chat model (agents/runtime.ts); never true in a deployment.
  if (process.env.CATCHUP_TEST_MODEL === "scripted" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) return null;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const preferGemini = process.env.AI_PROVIDER === "gemini";
  if (openaiKey && !(preferGemini && geminiKey)) {
    return openAiCompatible("openai", new OpenAI({ apiKey: openaiKey, timeout: 30_000, maxRetries: 2 }), process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", 64);
  }
  if (geminiKey) {
    return openAiCompatible("gemini", new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL, timeout: 30_000, maxRetries: 2 }), process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001", 32);
  }
  return null;
}

export function toPgVector(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS || values.some((v) => !Number.isFinite(v))) throw new RangeError("Invalid embedding");
  return `[${values.join(",")}]`;
}
