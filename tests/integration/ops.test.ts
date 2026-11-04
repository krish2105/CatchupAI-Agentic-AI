import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { opsFlags, resetOpsFlagsCache } from "@/lib/ai/guard";
import { isOpsOwner, opsSnapshot, updateOpsFlags } from "@/lib/ops/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { admin } from "./helpers";

const adminDb = () => admin() as unknown as AdminSupabase;
let original: { ai_enabled: boolean; daily_token_budget: number; note: string | null } | null = null;

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  if (original) await admin().from("ops_flags").update(original).eq("id", 1);
  resetOpsFlagsCache();
});

describe("ops owner gate", () => {
  it("only exact, configured, non-anonymous emails are owners", () => {
    vi.stubEnv("OPS_OWNER_EMAILS", "Owner@Example.com, second@example.com");
    expect(isOpsOwner({ email: "owner@example.com", is_anonymous: false })).toBe(true);
    expect(isOpsOwner({ email: "second@example.com" })).toBe(true);
    expect(isOpsOwner({ email: "owner@example.com.evil.test" })).toBe(false);
    expect(isOpsOwner({ email: "someone@example.com" })).toBe(false);
    expect(isOpsOwner({ email: "owner@example.com", is_anonymous: true })).toBe(false);
    expect(isOpsOwner({ email: undefined })).toBe(false);
  });

  it("nobody is an owner when the variable is unset", () => {
    vi.stubEnv("OPS_OWNER_EMAILS", "");
    expect(isOpsOwner({ email: "owner@example.com" })).toBe(false);
  });
});

describe("ops controls", () => {
  it("pauses and resumes AI and sets the budget, which the AI guard then reads", async () => {
    original = (await admin().from("ops_flags").select("ai_enabled, daily_token_budget, note").eq("id", 1).single()).data;
    await updateOpsFlags(adminDb(), { aiEnabled: false, dailyTokenBudget: 123_456, note: "maintenance" });
    resetOpsFlagsCache();
    expect(await opsFlags(adminDb())).toEqual({ aiEnabled: false, dailyTokenBudget: 123_456, note: "maintenance" });
    await updateOpsFlags(adminDb(), { aiEnabled: true, dailyTokenBudget: original!.daily_token_budget, note: null });
    resetOpsFlagsCache();
    expect((await opsFlags(adminDb())).aiEnabled).toBe(true);
  });

  it("rejects out-of-range values", async () => {
    await expect(updateOpsFlags(adminDb(), { aiEnabled: true, dailyTokenBudget: -1, note: null })).rejects.toThrow();
    await expect(updateOpsFlags(adminDb(), { aiEnabled: true, dailyTokenBudget: 1000, note: "x".repeat(301) })).rejects.toThrow();
  });

  it("summarises today's AI use and the open error groups", async () => {
    const snap = await opsSnapshot(adminDb(), Date.now());
    expect(snap.ai).toMatchObject({ enabled: expect.any(Boolean), envKillSwitch: false, budget: expect.any(Number), tokensToday: expect.any(Number) });
    expect(snap.runsToday).toMatchObject({ total: expect.any(Number), failed: expect.any(Number), fellBack: expect.any(Number) });
    expect(Array.isArray(snap.errorGroups)).toBe(true);
  });
});
