import { afterEach, describe, expect, it, vi } from "vitest";
import { ciStatus } from "@/lib/quality/live";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ciStatus", () => {
  it("reads only the CI workflow for the deployed commit, not the scheduled workflows", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
    const fetchMock = vi.fn(async () => json({ workflow_runs: [{ status: "completed", conclusion: "success", html_url: "u", head_sha: "abc123", updated_at: "t", jobs_url: "j" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const ci = await ciStatus();
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/actions/workflows/ci.yml/runs?head_sha=abc123");
    expect(ci).toMatchObject({ state: "passed", scope: "this deployment", failed: [] });
  });

  it("names the failed job and step", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url === "jobs"
        ? json({ jobs: [{ name: "Build", conclusion: "success" }, { name: "E2E", conclusion: "failure", steps: [{ name: "Checkout", conclusion: "success" }, { name: "Start local Supabase", conclusion: "failure" }] }] })
        : json({ workflow_runs: [{ status: "completed", conclusion: "failure", html_url: "u", head_sha: "s", updated_at: "t", jobs_url: "jobs" }] }),
    ));
    expect(await ciStatus()).toMatchObject({ state: "failed", scope: "latest on main", failed: ["E2E: Start local Supabase"] });
  });

  it("still reports the failure when the jobs can't be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url === "jobs" ? new Response("", { status: 500 }) : json({ workflow_runs: [{ status: "completed", conclusion: "failure", html_url: "u", head_sha: "s", updated_at: "t", jobs_url: "jobs" }] }),
    ));
    expect(await ciStatus()).toMatchObject({ state: "failed", failed: [] });
  });
});
