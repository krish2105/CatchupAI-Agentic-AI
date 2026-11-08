import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export const GITHUB_REPO = "krish2105/CatchupAI-Agentic-AI";

export type CiStatus = { state: "passed" | "failed" | "running" | "unknown"; url: string | null; sha: string | null; at: string | null; scope: "this deployment" | "latest on main"; failed: string[] };

const GITHUB = { headers: { accept: "application/vnd.github+json", "user-agent": "catchup-ai-quality-page" }, next: { revalidate: 300 } };
type Job = { name: string; conclusion: string | null; steps?: { name: string; conclusion: string | null }[] };

/**
 * Result of the CI workflow (ci.yml) for the deployed commit (or the latest main run locally). Only ci.yml counts:
 * the scheduled uptime and error-alert workflows also run on the deployed commit and must not show as a CI result.
 * A failed run names its failed jobs and steps. Cached for 5 minutes.
 */
export async function ciStatus(): Promise<CiStatus> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const scope = sha ? "this deployment" : "latest on main";
  const query = sha ? `head_sha=${sha}&per_page=1` : "branch=main&per_page=1";
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/ci.yml/runs?${query}`, { ...GITHUB, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    const run = ((await res.json()) as { workflow_runs?: { status: string; conclusion: string | null; html_url: string; head_sha: string; updated_at: string; jobs_url: string }[] }).workflow_runs?.[0];
    if (!run) return { state: "unknown", url: null, sha, at: null, scope, failed: [] };
    const state = run.status !== "completed" ? "running" : run.conclusion === "success" ? "passed" : "failed";
    return { state, url: run.html_url, sha: run.head_sha, at: run.updated_at, scope, failed: state === "failed" ? await failedJobs(run.jobs_url) : [] };
  } catch {
    return { state: "unknown", url: null, sha, at: null, scope, failed: [] };
  }
}

/** "Job: step" for each failed job; empty when the jobs can't be read (the page still links the run). */
async function failedJobs(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { ...GITHUB, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const { jobs = [] } = (await res.json()) as { jobs?: Job[] };
    return jobs.filter((j) => j.conclusion === "failure").map((j) => {
      const step = j.steps?.find((s) => s.conclusion === "failure")?.name;
      return step ? `${j.name}: ${step}` : j.name;
    });
  } catch {
    return [];
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
