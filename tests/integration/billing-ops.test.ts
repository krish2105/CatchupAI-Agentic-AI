import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billingOps } from "@/lib/billing/ops";
import { billingConfig } from "@/lib/billing/stripe";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

let owner: { id: string; db: Db };
let org: string;
const adminDb = () => admin() as unknown as AdminSupabase;
const run = randomUUID().slice(0, 8);

beforeAll(async () => {
  owner = await signedInUser("bops-owner");
  org = (await owner.db.rpc("create_organization", { p_name: "Ops school" })).data as string;
  await admin().rpc("apply_org_subscription", {
    p_event_id: `evt_bops_${run}`, p_event_type: "customer.subscription.created", p_event_at: new Date().toISOString(), p_org: org, p_plan: "class", p_status: "active",
    p_seats: 300, p_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(), p_customer: `cus_bops_${run}`, p_subscription: `sub_bops_${run}`,
  });
});
afterAll(async () => {
  await admin().from("organizations").delete().eq("id", org);
  if (owner) await deleteUser(owner.id);
});

describe("billing operations summary", () => {
  it("reports mode, plan counts and the latest processed webhook events without billing ids", async () => {
    const ops = await billingOps(adminDb(), billingConfig({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_CLASS: "price_x" }));
    expect(ops.mode).toBe("test");
    expect(ops.plans.class).toBeGreaterThanOrEqual(1);
    expect(ops.lastWebhookAt).not.toBeNull();
    const mine = ops.recentEvents.find((e) => e.id === `evt_bops_${run}`);
    expect(mine).toMatchObject({ type: "customer.subscription.created", orgName: "Ops school" });
    expect(JSON.stringify(ops)).not.toMatch(/cus_bops|sub_bops/);
  });

  it("says billing is off without settings", async () => {
    expect((await billingOps(adminDb(), billingConfig({}))).mode).toBe("off");
  });
});
