import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentDailyLimit, clearPlanCache } from "@/lib/billing/plan-limits";
import { LIMITS } from "@/lib/http/rate-limit";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let teacher: User;
let member: User;
let outsider: User;
let org: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;

beforeAll(async () => {
  [teacher, member, outsider] = await Promise.all(["pl-teacher", "pl-member", "pl-outsider"].map((l) => signedInUser(l)));
  org = (await teacher.db.rpc("create_organization", { p_name: "Limits school" })).data as string;
  const code = (await teacher.db.rpc("organization_join_code", { p_org: org })).data as string;
  await member.db.rpc("join_organization", { p_code: code });
});
afterAll(async () => {
  await admin().from("organizations").delete().eq("id", org);
  await Promise.all([teacher, member, outsider].filter(Boolean).map((u) => deleteUser(u.id)));
});

const setPlan = async (status: "active" | "canceled", at: number) =>
  admin().rpc("apply_org_subscription", {
    p_event_id: `evt_pl_${randomUUID()}`, p_event_type: "customer.subscription.updated", p_event_at: new Date(at).toISOString(), p_org: org,
    p_plan: status === "active" ? "class" : "free", p_status: status, p_seats: status === "active" ? 300 : 40, p_period_end: new Date(at + 30 * 86400_000).toISOString(), p_customer: `cus_pl_${org.slice(0, 8)}`, p_subscription: `sub_pl_${org.slice(0, 8)}`,
  });

describe("AI limits by plan", () => {
  it("free-plan members and students without an organisation keep the standard daily copilot limit", async () => {
    clearPlanCache();
    expect(await agentDailyLimit(asServer(member.db), member.id)).toBe(LIMITS.agent.limit);
    expect(await agentDailyLimit(asServer(outsider.db), outsider.id)).toBe(LIMITS.agent.limit);
  });

  it("members of an active Class-plan organisation get twice the limit; it drops back when the plan is cancelled", async () => {
    await setPlan("active", Date.now() - 60_000);
    clearPlanCache();
    expect(await agentDailyLimit(asServer(member.db), member.id)).toBe(LIMITS.agent.limit * 2);
    expect(await agentDailyLimit(asServer(teacher.db), teacher.id)).toBe(LIMITS.agent.limit * 2);
    expect(await agentDailyLimit(asServer(outsider.db), outsider.id)).toBe(LIMITS.agent.limit);
    await setPlan("canceled", Date.now());
    clearPlanCache();
    expect(await agentDailyLimit(asServer(member.db), member.id)).toBe(LIMITS.agent.limit);
  });
});
