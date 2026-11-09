import { embeddingProvider } from "@/lib/rag/embed";

type Env = Record<string, string | undefined>;

/** The copilot's provider, by the same rule as modelRuntime(): AI_PROVIDER wins, else OpenAI (key and model), else Gemini. */
export function chatProvider(env: Env = process.env): "openai" | "gemini" | null {
  const preferred = env.AI_PROVIDER?.trim().toLowerCase();
  const openai = Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL?.trim());
  const gemini = Boolean(env.GEMINI_API_KEY);
  if (preferred === "openai") return openai ? "openai" : null;
  if (preferred === "gemini") return gemini ? "gemini" : null;
  return openai ? "openai" : gemini ? "gemini" : null;
}

/** Which AI processors this deployment actually sends data to (chat model, embeddings, scanned-PDF reading). */
export function aiProcessors(env: Env = process.env): { openai: boolean; gemini: boolean } {
  const chat = chatProvider(env);
  const embeddings = embeddingProvider(env);
  const ocr = Boolean(env.GEMINI_API_KEY) && env.PDF_OCR?.trim().toLowerCase() !== "off";
  return { openai: chat === "openai" || embeddings === "openai", gemini: chat === "gemini" || embeddings === "gemini" || ocr };
}
