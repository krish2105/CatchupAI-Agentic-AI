import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { ApiError } from "./errors";

export const LIMITS = {
  write: { bucket: "write", limit: 120, windowSeconds: 60 },
  upload: { bucket: "upload", limit: 20, windowSeconds: 3600 },
  agent: { bucket: "agent", limit: 30, windowSeconds: 86400 },
  quiz: { bucket: "quiz", limit: 20, windowSeconds: 86400 },
} as const;

/** Per-student fixed-window limit stored in Postgres (works across serverless instances). */
export async function enforceRateLimit(supabase: ServerSupabase, kind: keyof typeof LIMITS) {
  const { bucket, limit, windowSeconds } = LIMITS[kind];
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw new ApiError(500, "rate_limit_unavailable", "Please try again.", error.message);
  if (data !== true) throw new ApiError(429, "rate_limited", "Too many requests. Please slow down and try again later.");
}
