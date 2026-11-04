import "server-only";

/** Last uptime checks, from the public GitHub Actions API for the repository (no token; best effort). */
export type UptimeRun = { at: string; conclusion: string | null; status: string; url: string };

export async function uptimeHistory(perPage = 24): Promise<UptimeRun[] | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/krish2105/CatchupAI-Agentic-AI/actions/workflows/uptime.yml/runs?per_page=${perPage}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "catchup-ai-status" },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { workflow_runs?: { created_at: string; conclusion: string | null; status: string; html_url: string }[] };
    return (json.workflow_runs ?? []).map((r) => ({ at: r.created_at, conclusion: r.conclusion, status: r.status, url: r.html_url }));
  } catch {
    return null;
  }
}
