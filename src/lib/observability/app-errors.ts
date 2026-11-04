import "server-only";
import { adminClient, type AdminSupabase } from "@/lib/supabase/admin";
import { errorFingerprint, normalizeErrorPath, redactErrorText, type ErrorSource } from "./error-text";
import { logEvent } from "./log";

export type ErrorGroup = {
  fingerprint: string;
  source: ErrorSource;
  path: string;
  errorName: string;
  message: string;
  stack: string | null;
  release: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
  notifiedAt: string | null;
  resolvedAt: string | null;
};

const COLUMNS = "fingerprint, source, path, error_name, message, stack, release, count, first_seen, last_seen, notified_at, resolved_at";
type Row = { fingerprint: string; source: string; path: string; error_name: string; message: string; stack: string | null; release: string | null; count: number; first_seen: string; last_seen: string; notified_at: string | null; resolved_at: string | null };
const toGroup = (r: Row): ErrorGroup => ({
  fingerprint: r.fingerprint, source: r.source as ErrorSource, path: r.path, errorName: r.error_name, message: r.message, stack: r.stack, release: r.release,
  count: r.count, firstSeen: r.first_seen, lastSeen: r.last_seen, notifiedAt: r.notified_at, resolvedAt: r.resolved_at,
});

/**
 * Records one error into its group. Everything is redacted first (secrets, emails, ids, IPs, numbers) and the
 * stack keeps only its first frames. Never throws and gives up after 1.5 s: error tracking must not turn one
 * failure into two.
 */
export async function recordAppError(input: { source: ErrorSource; path: string; error: unknown }, client?: AdminSupabase) {
  try {
    const e = input.error as { name?: unknown; message?: unknown; stack?: unknown; digest?: unknown } | null;
    const name = redactErrorText(typeof e?.name === "string" && e.name ? e.name : "Error", 100);
    const rawMessage = typeof e?.message === "string" && e.message ? e.message : typeof e?.digest === "string" ? `digest ${e.digest}` : String(input.error ?? "unknown");
    const message = redactErrorText(rawMessage, 500);
    const stack = typeof e?.stack === "string" ? redactErrorText(e.stack.split("\n").slice(0, 8).join("\n"), 2000) : null;
    const path = normalizeErrorPath(input.path || "/");
    const fingerprint = errorFingerprint({ source: input.source, path, name, message });
    const write = (client ?? adminClient()).rpc("record_app_error", {
      p_fingerprint: fingerprint, p_source: input.source, p_path: path, p_name: name, p_message: message, p_stack: stack as string, p_release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
    const result = await Promise.race([write, new Promise<{ error: { message: string } }>((r) => setTimeout(() => r({ error: { message: "timeout" } }), 1500))]);
    if (result.error) logEvent("warn", "app_error.record_failed", { fingerprint, reason: result.error.message.slice(0, 80) });
    return fingerprint;
  } catch {
    return null;
  }
}

export async function listErrorGroups(client: AdminSupabase, opts: { includeResolved?: boolean; limit?: number } = {}): Promise<ErrorGroup[]> {
  let query = client.from("app_error_groups").select(COLUMNS).order("last_seen", { ascending: false }).limit(opts.limit ?? 50);
  if (!opts.includeResolved) query = query.is("resolved_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Row[]).map(toGroup);
}

/** Atomically marks every not-yet-reported open group as notified and returns them (for the alert job). */
export async function claimNewErrorGroups(client: AdminSupabase): Promise<ErrorGroup[]> {
  const { data, error } = await client.from("app_error_groups").update({ notified_at: new Date().toISOString() }).is("notified_at", null).is("resolved_at", null).select(COLUMNS);
  if (error) throw error;
  return (data as Row[]).map(toGroup);
}

export async function resolveErrorGroup(client: AdminSupabase, fingerprint: string) {
  const { error } = await client.from("app_error_groups").update({ resolved_at: new Date().toISOString() }).eq("fingerprint", fingerprint);
  if (error) throw error;
}
