import type { Metadata } from "next";
import OrgPanel from "@/components/features/org/org-panel";
import PageHeading from "@/components/ui/page-heading";
import { Notice } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listMyOrganizations } from "@/lib/org/service";
import { renderTime } from "@/lib/server/clock";
import { billingConfig } from "@/lib/billing/stripe";

export const metadata: Metadata = { title: "Organisations" };

/** Schools and classes: join with a code, choose whether to count in class totals, and (staff) see aggregates. */
export default async function OrgPage({ searchParams }: { searchParams: Promise<{ billing?: string; join?: string }> }) {
  const { supabase, user } = await requirePageUser("/org");
  const params = await searchParams;
  const cfg = billingConfig();
  const billing = { enabled: cfg.enabled, mode: cfg.mode, classSeats: cfg.classSeats, priceLabel: process.env.STRIPE_PRICE_CLASS_LABEL?.trim() || null };
  const anonymous = user.isAnonymous;
  const orgs = anonymous ? [] : await listMyOrganizations(supabase, user.id, await renderTime());
  return (
    <>
      <PageHeading
        eyebrow="Your school or class"
        title="Learn together,"
        accent="keep your notes private."
        description="Join your class with the code your teacher gives you. Teachers see class totals only, never your notes, answers or plans, and only if you choose to share."
      />
      {params.billing === "success" ? <div style={{ marginBottom: 14 }}><Notice tone="info" title="Thanks. Your Class plan starts as soon as Stripe confirms the payment.">This page updates within a minute; refresh if the plan still shows Free.</Notice></div> : null}
      {params.billing === "cancel" ? <div style={{ marginBottom: 14 }}><Notice tone="info" title="Checkout cancelled. Nothing was charged." /></div> : null}
      {orgs === null ? (
        <Notice tone="info" title="Organisations are coming soon.">This part of CatchUp AI isn&apos;t switched on yet. Everything else works as usual.</Notice>
      ) : (
        <OrgPanel orgs={orgs} anonymous={anonymous} billing={billing} initialCode={/^[A-Za-z0-9]{10}$/.test(params.join ?? "") ? params.join! : ""} />
      )}
    </>
  );
}
