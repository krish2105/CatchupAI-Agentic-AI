import { embeddingProvider } from "@/lib/rag/embed";

type Env = Record<string, string | undefined>;

/** The copilot's provider, by the same rule as modelRuntime(): OpenAI when both a key and a model are set. */
export function chatProvider(env: Env = process.env): "openai" | null {
  return env.OPENAI_API_KEY && env.OPENAI_MODEL?.trim() ? "openai" : null;
}

/** Whether this deployment sends data to OpenAI (the copilot, the search embeddings or scanned-PDF reading). */
export function aiProcessors(env: Env = process.env): { openai: boolean } {
  return { openai: chatProvider(env) === "openai" || embeddingProvider(env) === "openai" };
}
