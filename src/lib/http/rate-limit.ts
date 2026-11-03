import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { ApiError } from "./errors";

type Limit = { bucket: string; limit: number; windowSeconds: number };

// Buckets and windows must match the allowlist in consume_rate_limit (migration 20261104000009).
export const LIMITS = {
  write: { bucket: "write", limit: 120, windowSeconds: 60 },
  upload: { bucket: "upload", limit: 20, windowSeconds: 3600 },
  agent: { bucket: "agent", limit: 30, windowSeconds: 86400 },
  quiz: { bucket: "quiz", limit: 20, windowSeconds: 86400 },
  teach: { bucket: "teach", limit: 40, windowSeconds: 86400 },
  compute: { bucket: "compute", limit: 300, windowSeconds: 3600 },
  account: { bucket: "account", limit: 5, windowSeconds: 3600 },
} as const satisfies Record<string, Limit>;

/**
 * Anonymous demo accounts are cheap to create, so each gets a much smaller budget for the operations that
 * cost money or storage (AI runs, uploads, generated checks).
 */
export const DEMO_LIMITS: Partial<Record<keyof typeof LIMITS, Limit>> = {
  agent: { bucket: "agent_demo", limit: 5, windowSeconds: 86400 },
  upload: { bucket: "upload_demo", limit: 6, windowSeconds: 3600 },
  quiz: { bucket: "quiz_demo", limit: 10, windowSeconds: 86400 },
  teach: { bucket: "teach_demo", limit: 20, windowSeconds: 86400 },
};

/** Per-student fixed-window limit stored in Postgres (works across serverless instances). */
export async function enforceRateLimit(supabase: ServerSupabase, kind: keyof typeof LIMITS, user?: { isAnonymous: boolean }) {
  const { bucket, limit, windowSeconds } = (user?.isAnonymous ? DEMO_LIMITS[kind] : undefined) ?? LIMITS[kind];
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw new ApiError(500, "rate_limit_unavailable", "Please try again.", error.message);
  if (data !== true) {
    throw new ApiError(429, "rate_limited", user?.isAnonymous && DEMO_LIMITS[kind] ? "The demo account has reached its limit for this. Sign up for a full account to continue." : "Too many requests. Please slow down and try again later.");
  }
}
