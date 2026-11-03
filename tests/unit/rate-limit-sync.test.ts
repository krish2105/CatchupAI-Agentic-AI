import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("rate-limit buckets stay in sync with the database allowlist", () => {
  it("every bucket and window in the app matches migration 20261104000009", async () => {
    const { DEMO_LIMITS, LIMITS } = await import("@/lib/http/rate-limit");
    const sql = readFileSync("supabase/migrations/20261104000009_rate_limit_allowlist.sql", "utf8");
    const allow = Object.fromEntries([...sql.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    for (const l of [...Object.values(LIMITS), ...Object.values(DEMO_LIMITS)]) {
      expect(allow[l!.bucket], l!.bucket).toBe(l!.windowSeconds);
      expect(l!.limit).toBeLessThanOrEqual(1000);
    }
  });
});
