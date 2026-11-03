import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/errors";
import { DEMO_LIMITS, enforceRateLimit } from "@/lib/http/rate-limit";
import type { ServerSupabase } from "@/lib/supabase/server";
import { anon, deleteUser, signedInUser, type Db } from "./helpers";

let student: { id: string; db: Db };
let demo: { id: string; db: Db };
const asServer = (db: Db) => db as unknown as ServerSupabase;

beforeAll(async () => {
  student = await signedInUser("abuse");
  const db = anon();
  const { data, error } = await db.auth.signInAnonymously();
  if (error) throw error;
  demo = { id: data.user!.id, db };
});

afterAll(async () => {
  await Promise.all([student && deleteUser(student.id), demo && deleteUser(demo.id)]);
});

describe("rate-limit function hardening (SECURITY_AUDIT M-2)", () => {
  it("rejects unknown buckets and mismatched windows when called directly through the API", async () => {
    const unknown = await student.db.rpc("consume_rate_limit", { p_bucket: `junk-${crypto.randomUUID()}`, p_limit: 5, p_window_seconds: 60 });
    expect(unknown.error?.code).toBe("22023");
    const wrongWindow = await student.db.rpc("consume_rate_limit", { p_bucket: "write", p_limit: 5, p_window_seconds: 7 });
    expect(wrongWindow.error?.code).toBe("22023");
    const ok = await student.db.rpc("consume_rate_limit", { p_bucket: "write", p_limit: 5, p_window_seconds: 60 });
    expect(ok.error).toBeNull();
  });

  it("is not callable without a session", async () => {
    const res = await anon().rpc("consume_rate_limit", { p_bucket: "write", p_limit: 5, p_window_seconds: 60 });
    expect(res.error).not.toBeNull();
  });
});

describe("demo-account budget (SECURITY_AUDIT H-1)", () => {
  it("gives anonymous accounts a small AI budget, separate from full accounts", async () => {
    const budget = DEMO_LIMITS.agent!.limit;
    for (let i = 0; i < budget; i++) await enforceRateLimit(asServer(demo.db), "agent", { isAnonymous: true });
    await expect(enforceRateLimit(asServer(demo.db), "agent", { isAnonymous: true })).rejects.toMatchObject({ status: 429 });
    // A full account is unaffected by the demo bucket.
    await expect(enforceRateLimit(asServer(student.db), "agent", { isAnonymous: false })).resolves.toBeUndefined();
  });

  it("error type stays a safe ApiError", async () => {
    const err = await enforceRateLimit(asServer(demo.db), "agent", { isAnonymous: true }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).not.toMatch(/sql|postgres|stack/i);
  });
});
