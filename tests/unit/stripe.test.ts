import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { billingConfig, createCheckoutSession, subscriptionUpdate, verifyStripeSignature } from "@/lib/billing/stripe";

const secret = "whsec_test_secret";
const sign = (body: string, t: number, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${body}`).digest("hex")}`;
const now = 1_793_800_000;

describe("Stripe webhook signature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", created: now, data: { object: {} } });

  it("accepts a correctly signed, fresh payload and returns the event", () => {
    expect(verifyStripeSignature(body, sign(body, now), secret, now).id).toBe("evt_1");
    // Several v1 signatures (secret rotation): any match is enough.
    expect(verifyStripeSignature(body, `${sign(body, now, "whsec_old")},v1=${sign(body, now).split("v1=")[1]}`, secret, now).id).toBe("evt_1");
  });

  it("rejects a wrong secret, an edited body, a missing header and an old timestamp (replay)", () => {
    expect(() => verifyStripeSignature(body, sign(body, now, "whsec_other"), secret, now)).toThrow(/signature/);
    expect(() => verifyStripeSignature(body.replace("evt_1", "evt_2"), sign(body, now), secret, now)).toThrow(/signature/);
    expect(() => verifyStripeSignature(body, null, secret, now)).toThrow(/signature/);
    expect(() => verifyStripeSignature(body, sign(body, now - 301), secret, now)).toThrow(/old/);
  });
});

describe("subscription events → organisation plan", () => {
  const event = (type: string, status: string, extra: Record<string, unknown> = {}) => ({
    id: "evt_9", type, created: now,
    data: { object: { id: "sub_1", customer: "cus_1", status, current_period_end: now + 30 * 86400, metadata: { org_id: "00000000-0000-4000-8000-000000000001" }, items: { data: [{ quantity: 1 }] }, ...extra } },
  });

  it("an active or trialing subscription is the class plan with the configured seats", () => {
    expect(subscriptionUpdate(event("customer.subscription.created", "active"), 300)).toMatchObject({ orgId: "00000000-0000-4000-8000-000000000001", plan: "class", status: "active", seats: 300, customer: "cus_1", subscription: "sub_1" });
    expect(subscriptionUpdate(event("customer.subscription.updated", "trialing"), 300)?.plan).toBe("class");
    expect(subscriptionUpdate(event("customer.subscription.updated", "past_due"), 300)).toMatchObject({ plan: "class", status: "past_due" });
  });

  it("a cancelled or unpaid subscription returns the organisation to the free plan", () => {
    expect(subscriptionUpdate(event("customer.subscription.deleted", "canceled"), 300)).toMatchObject({ plan: "free", status: "canceled", seats: 40 });
    expect(subscriptionUpdate(event("customer.subscription.updated", "unpaid"), 300)).toMatchObject({ plan: "free", status: "canceled" });
  });

  it("ignores other events and subscriptions without a valid organisation id", () => {
    expect(subscriptionUpdate(event("invoice.paid", "active"), 300)).toBeNull();
    expect(subscriptionUpdate(event("customer.subscription.updated", "active", { metadata: { org_id: "not-a-uuid" } }), 300)).toBeNull();
  });
});

describe("billing configuration and checkout", () => {
  const env = { STRIPE_SECRET_KEY: "sk_test_123", STRIPE_WEBHOOK_SECRET: secret, STRIPE_PRICE_CLASS: "price_123" };

  it("is off unless key, webhook secret and price are all set, and refuses live keys unless allowed", () => {
    expect(billingConfig({}).enabled).toBe(false);
    expect(billingConfig({ ...env, STRIPE_PRICE_CLASS: "" }).enabled).toBe(false);
    expect(billingConfig(env)).toMatchObject({ enabled: true, mode: "test", classSeats: 300 });
    expect(billingConfig({ ...env, STRIPE_SECRET_KEY: "sk_live_1" }).enabled).toBe(false);
    expect(billingConfig({ ...env, STRIPE_SECRET_KEY: "sk_live_1", STRIPE_ALLOW_LIVE: "1" })).toMatchObject({ enabled: true, mode: "live" });
  });

  it("creates a subscription checkout for one organisation with an idempotency key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const url = await createCheckoutSession({ orgId: "00000000-0000-4000-8000-000000000001", email: "t@example.com", successUrl: "https://app/org?billing=done", cancelUrl: "https://app/org" }, billingConfig(env), fetchImpl);
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(Object.fromEntries(body)).toMatchObject({ mode: "subscription", "line_items[0][price]": "price_123", "line_items[0][quantity]": "1", "subscription_data[metadata][org_id]": "00000000-0000-4000-8000-000000000001", client_reference_id: "00000000-0000-4000-8000-000000000001", customer_email: "t@example.com" });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk_test_123");
    expect(headers["Idempotency-Key"]).toMatch(/^checkout-00000000-0000-4000-8000-000000000001-/);
  });

  it("reports Stripe's error message when checkout fails", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { message: "No such price" } }), { status: 400 })) as unknown as typeof fetch;
    await expect(createCheckoutSession({ orgId: "00000000-0000-4000-8000-000000000001", successUrl: "https://a", cancelUrl: "https://a" }, billingConfig(env), fetchImpl)).rejects.toThrow(/No such price/);
  });
});
