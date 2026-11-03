import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export const GITHUB_REPO = "krish2105/CatchupAI-Agentic-AI";

export type CiStatus = { state: "passed" | "failed" | "running" | "unknown"; url: string | null; sha: string | null; at: string | null; scope: "this deployment" | "latest on main" };

/** GitHub Actions result for the deployed commit (or the latest main run locally). Cached for 5 minutes. */
export async function ciStatus(): Promise<CiStatus> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const query = sha ? `head_sha=${sha}&per_page=1` : "branch=main&per_page=1";
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?${query}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "catchup-ai-quality-page" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const run = ((await res.json()) as { workflow_runs?: { status: string; conclusion: string | null; html_url: string; head_sha: string; updated_at: string }[] }).workflow_runs?.[0];
    if (!run) return { state: "unknown", url: null, sha, at: null, scope: sha ? "this deployment" : "latest on main" };
    const state = run.status !== "completed" ? "running" : run.conclusion === "success" ? "passed" : "failed";
    return { state, url: run.html_url, sha: run.head_sha, at: run.updated_at, scope: sha ? "this deployment" : "latest on main" };
  } catch {
    return { state: "unknown", url: null, sha, at: null, scope: sha ? "this deployment" : "latest on main" };
  }
}

/** Live checks: database round trip and which optional services are configured (never their values). */
export async function health() {
  const started = Date.now();
  let database: "ok" | "down" = "down";
  try {
    const { error } = await adminClient().from("courses").select("id", { count: "exact", head: true }).limit(1);
    database = error ? "down" : "ok";
  } catch {
    database = "down";
  }
  return {
    database,
    databaseMs: Date.now() - started,
    email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    botCheck: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  };
}

/** Aggregate of student ratings only (no comments, no identities). */
export async function feedbackSummary() {
  try {
    const { data, error } = await adminClient().from("feedback").select("kind, rating").not("rating", "is", null).limit(5000);
    if (error) return null;
    const helpful = data.filter((f) => f.rating === 1).length;
    const byKind = ["answer", "plan", "pack", "teach"].map((kind) => {
      const rows = data.filter((f) => f.kind === kind);
      return { kind, ratings: rows.length, helpful: rows.filter((f) => f.rating === 1).length };
    });
    return { ratings: data.length, helpful, byKind };
  } catch {
    return null;
  }
}
