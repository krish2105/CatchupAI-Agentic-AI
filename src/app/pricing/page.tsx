import { ArrowLeft, Building2, Check, GraduationCap, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import { ButtonLink, Chip } from "@/components/ui/primitives";
import { billingConfig, FREE_SEATS } from "@/lib/billing/stripe";

export const metadata: Metadata = { title: "Plans", description: "Students never pay. Schools and classes can stay free or choose the Class plan." };

/**
 * Public plans page. The Class plan's price is shown only from STRIPE_PRICE_CLASS_LABEL (set by the owner to
 * match the Stripe price); nothing here is invented. With billing off, the Class plan says "coming soon".
 */
export default async function PricingPage() {
  await connection();
  const cfg = billingConfig();
  const label = process.env.STRIPE_PRICE_CLASS_LABEL?.trim() || null;
  const plans = [
    { id: "student", Icon: GraduationCap, name: "Student", price: "Free, always", note: "Every student feature, on every plan.", items: ["Copilot answers with page citations", "Recovery plans you approve", "Month calendar, tracker and reminders", "Practice checks, FSRS revision, teach-back", "Export or delete your data any time"] },
    { id: "org-free", Icon: Users, name: "Organisation", price: "Free", note: `Up to ${FREE_SEATS} members.`, items: ["Join by code or invite link", "Class totals from students who opt in (3 or more)", "Roster and roles for staff", "Audit log for admins"] },
    {
      id: "class",
      Icon: Building2,
      name: "Class plan",
      price: !cfg.enabled ? "Coming soon" : label ?? "Price shown at checkout",
      note: `Up to ${cfg.classSeats} members, billed to the organisation.`,
      items: ["Everything in Organisation", `Up to ${cfg.classSeats} seats`, "Higher daily AI limit for members", "Manage card, invoices and cancel in the billing portal"],
    },
  ];
  return (
    <div className="lp">
      <header className="lp-top">
        <Brand />
        <div className="top-actions">
          <ThemeButton />
          <ButtonLink href="/" small><ArrowLeft className="ic" aria-hidden="true" /> Home</ButtonLink>
        </div>
      </header>
      <main id="main" className="quality pricing">
        <div className="eyebrow">Plans</div>
        <h1>Students never pay.</h1>
        <p className="quality-lead">Schools and classes can stay on the free plan or move to the Class plan for more seats. A student&apos;s own study data and features are the same on every plan.</p>
        {cfg.mode === "test" ? <p><Chip tone="warn">Payments are in Stripe test mode: no real money is charged.</Chip></p> : null}
        <ul className="pricing-grid" aria-label="Plans">
          {plans.map((p) => (
            <li key={p.id} className="card card-inner" data-plan={p.id}>
              <p.Icon className="ic pricing-icon" aria-hidden="true" />
              <h2 className="trace-h2">{p.name}</h2>
              <p className="pricing-price">{p.price}</p>
              <p className="muted">{p.note}</p>
              <ul className="pricing-items">{p.items.map((i) => <li key={i}><Check className="ic" aria-hidden="true" /> {i}</li>)}</ul>
            </li>
          ))}
        </ul>
        <p className="muted">Teachers: create an organisation in <Link href="/org">Organisations</Link> (sign in first); the admin upgrades from there. See the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy notice</Link> for how payments work.</p>
      </main>
    </div>
  );
}
