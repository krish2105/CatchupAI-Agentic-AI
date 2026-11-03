import "server-only";
import { connection } from "next/server";

/** Server-side feature availability, read per request (never at build). Never returns secret values. */
export async function aiRuntimeStatus() {
  await connection();
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  const model = process.env.OPENAI_MODEL?.trim() || null;
  return { configured: hasKey && Boolean(model), hasKey, model };
}
