import "server-only";
import { connection } from "next/server";
import { runtimeInfo } from "@/lib/agents/runtime";

/** Server-side feature availability, read per request (never at build). Never returns secret values. */
export async function aiRuntimeStatus() {
  await connection();
  const info = runtimeInfo();
  return {
    configured: info.kind !== "none",
    kind: info.kind,
    model: info.kind === "none" ? null : info.model,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
  };
}
