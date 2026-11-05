import "server-only";
import { ApiError, fromDbError, isMissingSchema } from "@/lib/http/errors";
import { logEvent } from "@/lib/observability/log";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { createCheckoutSession, createPortalSession, subscriptionUpdate, verifyStripeSignature, type BillingConfig } from "./stripe";

/**
 * Organisation billing between the routes and Stripe. Admin checks are the database's (`org_billing` raises
 * 42501 for anyone who isn't that organisation's admin); billing ids are read with the service role only;
 * plan changes come only from verified webhooks through `apply_org_subscription` (idempotent, ordered).
 */
export type OrgBilling = { plan: "free" | "class"; planStatus: string; seatLimit: number; members: number; periodEnd: string | null; hasCustomer: boolean };

type BillingRow = { plan: string; plan_status: string; seat_limit: number; members: number; current_period_end: string | null; has_customer: boolean };

function billingError(error: { code?: string; message?: string }) {
  if (isMissingSchema(error)) return new ApiError(503, "not_available", "Organisations aren't available yet.");
  if (error.code === "42501") return new ApiError(403, "forbidden", "Only this organisation's admins can manage billing.");
  return fromDbError(error);
}

export async function orgBilling(supabase: ServerSupabase, orgId: string): Promise<OrgBilling> {
  const { data, error } = await supabase.rpc("org_billing", { p_org: orgId });
  if (error) throw billingError(error);
  const row = (data as BillingRow[] | null)?.[0];
  if (!row) throw new ApiError(404, "not_found", "Organisation not found.");
  return { plan: row.plan as OrgBilling["plan"], planStatus: row.plan_status, seatLimit: row.seat_limit, members: row.members, periodEnd: row.current_period_end, hasCustomer: row.has_customer };
}

const requireEnabled = (cfg: BillingConfig) => {
  if (!cfg.enabled) throw new ApiError(503, "billing_off", "Paid plans aren't available yet.");
};

/** Stripe Checkout for the Class plan. Admin only; returns the Checkout URL. */
export async function startCheckout(input: { supabase: ServerSupabase; orgId: string; email: string | null | undefined; appUrl: string }, cfg: BillingConfig, fetchImpl: typeof fetch = fetch) {
  requireEnabled(cfg);
  const billing = await orgBilling(input.supabase, input.orgId); // 403 unless admin
  if (billing.plan === "class" && billing.planStatus !== "canceled") throw new ApiError(409, "already_paid", "This organisation already has the Class plan. Use Manage billing to change it.");
  return createCheckoutSession({ orgId: input.orgId, email: input.email, successUrl: `${input.appUrl}/org?billing=success`, cancelUrl: `${input.appUrl}/org?billing=cancel` }, cfg, fetchImpl);
}

/** Stripe billing portal (card, invoices, cancel). Admin only; needs a Stripe customer from an earlier checkout. */
export async function openPortal(input: { supabase: ServerSupabase; admin: AdminSupabase; orgId: string; appUrl: string }, cfg: BillingConfig, fetchImpl: typeof fetch = fetch) {
  requireEnabled(cfg);
  const billing = await orgBilling(input.supabase, input.orgId); // 403 unless admin
  if (!billing.hasCustomer) throw new ApiError(409, "no_customer", "There's no billing account yet. Upgrade first.");
  const { data, error } = await input.admin.from("organizations").select("stripe_customer_id").eq("id", input.orgId).single();
  if (error || !data?.stripe_customer_id) throw new ApiError(409, "no_customer", "There's no billing account yet. Upgrade first.");
  return createPortalSession({ customer: data.stripe_customer_id, returnUrl: `${input.appUrl}/org` }, cfg, fetchImpl);
}

/**
 * A Stripe webhook delivery. Bad or missing signatures → 400. Verified events are acknowledged (200) even when
 * ignored, so Stripe doesn't retry them; subscription events update the organisation once and in order.
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null, admin: AdminSupabase, cfg: BillingConfig) {
  if (!cfg.webhookSecret || !cfg.enabled) throw new ApiError(503, "billing_off", "Billing isn't configured.");
  let event;
  try {
    event = verifyStripeSignature(rawBody, signature, cfg.webhookSecret);
  } catch (e) {
    logEvent("warn", "billing.webhook_rejected", { reason: e instanceof Error ? e.message : "invalid" });
    throw new ApiError(400, "invalid_signature", "Invalid signature.");
  }
  const update = subscriptionUpdate(event, cfg.classSeats);
  if (!update) return { received: true, applied: false, ignored: true };
  const { data, error } = await admin.rpc("apply_org_subscription", {
    p_event_id: update.eventId, p_event_type: update.eventType, p_event_at: update.eventAt, p_org: update.orgId, p_plan: update.plan, p_status: update.status,
    p_seats: update.seats, p_period_end: update.periodEnd as string, p_customer: update.customer as string, p_subscription: update.subscription as string,
  });
  if (error) throw fromDbError(error);
  logEvent("info", "billing.webhook", { type: update.eventType, applied: Boolean(data), plan: update.plan, status: update.status });
  return { received: true, applied: Boolean(data) };
}
