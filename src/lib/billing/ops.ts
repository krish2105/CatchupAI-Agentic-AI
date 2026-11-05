import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { BillingConfig } from "./stripe";

/**
 * Billing health for the owner's /ops page and the public /status page (service role, after the caller's own
 * checks). Organisation names, plan counts and processed webhook events only: never Stripe customer or
 * subscription ids. Null fields mean the billing tables aren't on this database yet.
 */
export type BillingOps = {
  mode: BillingConfig["mode"];
  plans: { free: number; class: number; pastDue: number };
  lastWebhookAt: string | null;
  recentEvents: { id: string; type: string; orgName: string | null; receivedAt: string }[];
};

export async function billingOps(admin: AdminSupabase, cfg: BillingConfig): Promise<BillingOps> {
  const [orgs, events] = await Promise.all([
    admin.from("organizations").select("plan, plan_status").limit(10000),
    admin.from("stripe_events").select("id, type, received_at, organizations(name)").order("received_at", { ascending: false }).limit(15),
  ]);
  const rows = orgs.error ? [] : (orgs.data as { plan: string; plan_status: string }[]);
  const recent = events.error ? [] : (events.data as unknown as { id: string; type: string; received_at: string; organizations: { name: string } | null }[]);
  return {
    mode: cfg.mode,
    plans: { free: rows.filter((r) => r.plan === "free").length, class: rows.filter((r) => r.plan === "class").length, pastDue: rows.filter((r) => r.plan_status === "past_due").length },
    lastWebhookAt: recent[0]?.received_at ?? null,
    recentEvents: recent.map((e) => ({ id: e.id, type: e.type, orgName: e.organizations?.name ?? null, receivedAt: e.received_at })),
  };
}
