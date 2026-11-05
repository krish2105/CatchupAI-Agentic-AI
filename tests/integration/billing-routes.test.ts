import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billingConfig } from "@/lib/billing/stripe";
import { handleStripeWebhook, openPortal, orgBilling, startCheckout } from "@/lib/billing/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let owner: User;
let member: User;
let org: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const cfg = billingConfig({ STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_test_fake", STRIPE_PRICE_CLASS: "price_test_fake", STRIPE_CLASS_SEATS: "120" });
const off = billingConfig({});
const run = randomUUID().slice(0, 8);

function signed(event: object, secret = "whsec_test_fake", t = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(event);
  return { body, header: `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}` };
}
const subEvent = (id: string, type: string, status: string, created: number) => ({
  id: `evt_${run}_${id}`, type, created, data: { object: { id: `sub_${run}`, customer: `cus_${run}`, status, current_period_end: created + 30 * 86400, metadata: { org_id: org } } },
});

beforeAll(async () => {
  [owner, member] = await Promise.all([signedInUser("bill-owner"), signedInUser("bill-member")]);
  org = (await owner.db.rpc("create_organization", { p_name: "Paid school" })).data as string;
  const code = (await owner.db.rpc("organization_join_code", { p_org: org })).data as string;
  await member.db.rpc("join_organization", { p_code: code });
});
afterAll(async () => {
  await admin().from("organizations").delete().eq("id", org);
  await Promise.all([owner, member].filter(Boolean).map((u) => deleteUser(u.id)));
});

describe("billing: checkout and portal", () => {
  it("is off (503) until all three Stripe settings are present", async () => {
    await expect(startCheckout({ supabase: asServer(owner.db), orgId: org, email: owner.email, appUrl: "http://localhost:3000" }, off)).rejects.toMatchObject({ status: 503, code: "billing_off" });
  });

  it("only an organisation's admin can start checkout; the org id travels in the subscription metadata", async () => {
    let sent = "";
    const fakeStripe: typeof fetch = async (_url, init) => {
      sent = String(init?.body);
      return new Response(JSON.stringify({ url: "https://checkout.stripe.test/s/1" }), { status: 200 });
    };
    await expect(startCheckout({ supabase: asServer(member.db), orgId: org, email: member.email, appUrl: "http://localhost:3000" }, cfg, fakeStripe)).rejects.toMatchObject({ status: 403 });
    const url = await startCheckout({ supabase: asServer(owner.db), orgId: org, email: owner.email, appUrl: "http://localhost:3000" }, cfg, fakeStripe);
    expect(url).toBe("https://checkout.stripe.test/s/1");
    const form = new URLSearchParams(sent);
    expect(form.get("subscription_data[metadata][org_id]")).toBe(org);
    expect(form.get("line_items[0][price]")).toBe("price_test_fake");
    expect(form.get("success_url")).toBe("http://localhost:3000/org?billing=success");
  });

  it("the billing portal needs an existing customer, read server-side only", async () => {
    await expect(openPortal({ supabase: asServer(owner.db), admin: adminDb(), orgId: org, appUrl: "http://localhost:3000" }, cfg)).rejects.toMatchObject({ status: 409, code: "no_customer" });
  });
});

describe("billing: Stripe webhook", () => {
  const now = Math.floor(Date.now() / 1000);

  it("rejects a bad or missing signature", async () => {
    const { body } = signed(subEvent("bad", "customer.subscription.created", "active", now));
    await expect(handleStripeWebhook(body, "t=1,v1=deadbeef", adminDb(), cfg)).rejects.toMatchObject({ status: 400 });
    await expect(handleStripeWebhook(body, null, adminDb(), cfg)).rejects.toMatchObject({ status: 400 });
    const forged = signed(subEvent("forged", "customer.subscription.created", "active", now), "whsec_attacker");
    await expect(handleStripeWebhook(forged.body, forged.header, adminDb(), cfg)).rejects.toMatchObject({ status: 400 });
  });

  it("a verified subscription moves the organisation to the Class plan with its seats; a replay changes nothing", async () => {
    const e = signed(subEvent("created", "customer.subscription.created", "active", now - 60));
    expect(await handleStripeWebhook(e.body, e.header, adminDb(), cfg)).toEqual({ received: true, applied: true });
    expect(await orgBilling(asServer(owner.db), org)).toMatchObject({ plan: "class", planStatus: "active", seatLimit: 120, members: 2, hasCustomer: true });
    expect(await handleStripeWebhook(e.body, e.header, adminDb(), cfg)).toEqual({ received: true, applied: false });
  });

  it("ignores events older than the last applied, and unrelated event types (still 200)", async () => {
    const old = signed(subEvent("old", "customer.subscription.updated", "canceled", now - 3600));
    expect(await handleStripeWebhook(old.body, old.header, adminDb(), cfg)).toEqual({ received: true, applied: false });
    expect((await orgBilling(asServer(owner.db), org)).plan).toBe("class");
    const other = signed({ id: `evt_${run}_inv`, type: "invoice.paid", created: now, data: { object: {} } });
    expect(await handleStripeWebhook(other.body, other.header, adminDb(), cfg)).toEqual({ received: true, applied: false, ignored: true });
  });

  it("cancelling returns the organisation to the free plan; the portal then opens for the stored customer", async () => {
    const cancel = signed(subEvent("deleted", "customer.subscription.deleted", "canceled", now - 10));
    expect(await handleStripeWebhook(cancel.body, cancel.header, adminDb(), cfg)).toEqual({ received: true, applied: true });
    expect(await orgBilling(asServer(owner.db), org)).toMatchObject({ plan: "free", seatLimit: 40 });
    let customer = "";
    const fakeStripe: typeof fetch = async (_url, init) => {
      customer = new URLSearchParams(String(init?.body)).get("customer") ?? "";
      return new Response(JSON.stringify({ url: "https://billing.stripe.test/p/1" }), { status: 200 });
    };
    expect(await openPortal({ supabase: asServer(owner.db), admin: adminDb(), orgId: org, appUrl: "http://localhost:3000" }, cfg, fakeStripe)).toBe("https://billing.stripe.test/p/1");
    expect(customer).toBe(`cus_${run}`);
    await expect(openPortal({ supabase: asServer(member.db), admin: adminDb(), orgId: org, appUrl: "http://localhost:3000" }, cfg, fakeStripe)).rejects.toMatchObject({ status: 403 });
  });

  it("is off (503) without a webhook secret, before reading the body", async () => {
    const e = signed(subEvent("off", "customer.subscription.created", "active", now));
    await expect(handleStripeWebhook(e.body, e.header, adminDb(), off)).rejects.toMatchObject({ status: 503 });
  });
});
