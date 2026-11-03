import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { assertAiAvailable, resetOpsFlagsCache } from "@/lib/ai/guard";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

let a: { id: string; db: Db };
const asAdmin = () => admin() as unknown as AdminSupabase;
const restore = () => admin().from("ops_flags").update({ ai_enabled: true, daily_token_budget: 2_000_000 }).eq("id", 1);

beforeAll(async () => {
  a = await signedInUser("guard-a");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await restore();
  resetOpsFlagsCache();
});
afterAll(async () => {
  await restore();
  if (a) await deleteUser(a.id);
});

describe("AI emergency controls", () => {
  it("allows a run when AI is enabled and within budget", async () => {
    await expect(assertAiAvailable(asAdmin(), a.id)).resolves.toBeUndefined();
  });

  it("the operator kill switch (database flag) pauses new AI runs", async () => {
    await admin().from("ops_flags").update({ ai_enabled: false }).eq("id", 1);
    resetOpsFlagsCache();
    await expect(assertAiAvailable(asAdmin(), a.id)).rejects.toMatchObject({ status: 503, code: "ai_paused" });
  });

  it("the environment kill switch works even if the database is unreachable", async () => {
    vi.stubEnv("AI_KILL_SWITCH", "1");
    await expect(assertAiAvailable(asAdmin(), a.id)).rejects.toMatchObject({ code: "ai_paused" });
  });

  it("stops new runs once today's token budget is spent", async () => {
    await admin().from("ops_flags").update({ daily_token_budget: 0 }).eq("id", 1);
    resetOpsFlagsCache();
    await expect(assertAiAvailable(asAdmin(), a.id)).rejects.toMatchObject({ status: 503, code: "ai_budget_reached" });
  });

  it("allows one run at a time per student", async () => {
    const { data } = await admin().from("agent_runs").insert({ owner_id: a.id, request_text: "x", model: "m", status: "running" }).select("id").single();
    await expect(assertAiAvailable(asAdmin(), a.id)).rejects.toMatchObject({ status: 429, code: "run_in_progress" });
    await admin().from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", data!.id);
    await expect(assertAiAvailable(asAdmin(), a.id)).resolves.toBeUndefined();
  });

  it("students can't read or change the operator flags", async () => {
    expect((await a.db.from("ops_flags" as never).select("*")).error?.code).toBe("42501");
    expect((await a.db.from("ops_flags" as never).update({ ai_enabled: false } as never).eq("id", 1)).error?.code).toBe("42501");
  });
});
