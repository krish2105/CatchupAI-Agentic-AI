/**
 * Stripe billing for organisations (the "Class" plan), without the Stripe SDK: Checkout and the billing portal
 * through the REST API, and webhooks verified by their HMAC signature. Off unless STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_CLASS are all set; live keys need STRIPE_ALLOW_LIVE=1 on top, so a
 * deployment can't start charging by accident. Students never pay: plans belong to organisations.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;
export const FREE_SEATS = 40;

export type BillingConfig = { enabled: boolean; mode: "test" | "live" | "off"; secretKey: string; webhookSecret: string; priceId: string; classSeats: number };

export function billingConfig(env: Env = process.env): BillingConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const priceId = env.STRIPE_PRICE_CLASS?.trim() ?? "";
  const classSeats = Math.min(5000, Math.max(1, Number(env.STRIPE_CLASS_SEATS) || 300));
  const live = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  const enabled = Boolean(secretKey && webhookSecret && priceId) && (!live || env.STRIPE_ALLOW_LIVE === "1");
  return { enabled, mode: enabled ? (live ? "live" : "test") : "off", secretKey, webhookSecret, priceId, classSeats };
}

export type StripeEvent = { id: string; type: string; created: number; data: { object: Record<string, unknown> } };

/**
 * Verifies the Stripe-Signature header (t=…,v1=…) over the RAW request body and returns the parsed event.
 * Rejects bodies older than `toleranceSeconds` (replays). Any one v1 signature may match (secret rotation).
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): StripeEvent {
  if (!header || !secret) throw new Error("missing signature");
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || signatures.length === 0) throw new Error("malformed signature");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  const ok = signatures.some((s) => {
    const given = Buffer.from(s ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new Error("invalid signature");
  if (Math.abs(nowSeconds - t) > toleranceSeconds) throw new Error("signature too old");
  return JSON.parse(rawBody) as StripeEvent;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE = new Set(["active", "trialing", "past_due"]);

export type SubscriptionUpdate = { eventId: string; eventType: string; eventAt: string; orgId: string; plan: "free" | "class"; status: "active" | "trialing" | "past_due" | "canceled" | "incomplete"; seats: number; periodEnd: string | null; customer: string | null; subscription: string | null };

/** Maps customer.subscription.* events to the organisation's plan; null for anything else. */
export function subscriptionUpdate(event: StripeEvent, classSeats: number): SubscriptionUpdate | null {
  if (!event.type.startsWith("customer.subscription.")) return null;
  const sub = event.data.object as { id?: string; customer?: string; status?: string; current_period_end?: number; metadata?: { org_id?: string } };
  const orgId = sub.metadata?.org_id ?? "";
  if (!UUID.test(orgId)) return null;
  const raw = event.type === "customer.subscription.deleted" ? "canceled" : (sub.status ?? "incomplete");
  const isClass = ACTIVE.has(raw);
  const status = isClass ? (raw as "active" | "trialing" | "past_due") : raw === "incomplete" ? "incomplete" : "canceled";
  return {
    eventId: event.id,
    eventType: event.type,
    eventAt: new Date(event.created * 1000).toISOString(),
    orgId,
    plan: isClass ? "class" : "free",
    status,
    seats: isClass ? classSeats : FREE_SEATS,
    periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    customer: typeof sub.customer === "string" ? sub.customer : null,
    subscription: sub.id ?? null,
  };
}

async function stripePost(path: string, form: Record<string, string>, cfg: BillingConfig, fetchImpl: typeof fetch, idempotencyKey: string) {
  const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": idempotencyKey },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) throw new Error(`Stripe: ${json.error?.message ?? `HTTP ${res.status}`}`);
  return json.url;
}

/** A Checkout session for one organisation's Class plan; the org id travels in the subscription's metadata. */
export function createCheckoutSession(input: { orgId: string; email?: string | null; successUrl: string; cancelUrl: string }, cfg: BillingConfig, fetchImpl: typeof fetch = fetch) {
  const form: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": cfg.priceId,
    "line_items[0][quantity]": "1",
    "subscription_data[metadata][org_id]": input.orgId,
    client_reference_id: input.orgId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: "true",
  };
  if (input.email) form.customer_email = input.email;
  return stripePost("checkout/sessions", form, cfg, fetchImpl, `checkout-${input.orgId}-${randomUUID()}`);
}

/** The Stripe billing portal for an organisation that already has a customer (change card, cancel, invoices). */
export function createPortalSession(input: { customer: string; returnUrl: string }, cfg: BillingConfig, fetchImpl: typeof fetch = fetch) {
  return stripePost("billing_portal/sessions", { customer: input.customer, return_url: input.returnUrl }, cfg, fetchImpl, `portal-${input.customer}-${randomUUID()}`);
}
