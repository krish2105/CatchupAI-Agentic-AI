import "server-only";
import type { Embedder } from "@/lib/rag/embed";
import type { Citation } from "@/lib/rag/retrieve";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";

/** One executed tool call, recorded by our own wrapper (never inferred from model text). */
export type ToolEvent = {
  tool: string;
  status: "completed" | "failed" | "denied";
  startedAt: string;
  durationMs: number;
  /** Privacy-safe argument summary (ids shortened, queries truncated). */
  args: Record<string, string | number | boolean | null>;
  outcome: string;
  /** 2 when the call ran during the fallback attempt on the second model (absent = first attempt). */
  attempt?: number;
  /** true when the result came from the short-lived per-student read cache (no database or embedding call). */
  cached?: boolean;
};

/** suspicious = the passage contains instructions aimed at an AI (see rag/injection.ts); it can never back a fact. */
export type SourceRef = Citation & { sourceId: string; suspicious?: boolean };

/**
 * Trusted, server-built context passed to every tool. The model never sees or sets these values:
 * identity comes from the verified session, the clients are scoped to that student.
 */
export type AgentContext = {
  userId: string;
  courseId: string | null;
  runId: string;
  now: number;
  supabase: ServerSupabase;
  admin: AdminSupabase;
  embedder: Embedder | null;
  events: ToolEvent[];
  /** Sources actually retrieved in this run, keyed by sourceId ("S1"...). Only these may be cited. */
  sources: Map<string, SourceRef>;
  /** Results the data tools (deadlines, availability, progress, drafted plan, memory) returned in this run: what a fact without a source id must be grounded in. */
  toolData?: string[];
  proposalId: string | null;
  /** 1 for the primary model, 2 after falling back. Per-request tool budgets count per attempt. */
  attempt: number;
  onEvent?: (event: ToolEvent) => void;
};

export function shortId(id: string | null | undefined) {
  return id ? `${id.slice(0, 8)}…` : null;
}
