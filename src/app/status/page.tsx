import { ArrowLeft, CheckCircle2, CircleAlert, CircleDashed, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import { ButtonLink, Chip } from "@/components/ui/primitives";
import { renderTime } from "@/lib/server/clock";
import { INCIDENTS } from "@/lib/status/incidents";
import { readiness } from "@/lib/status/readiness";
import { uptimeHistory } from "@/lib/status/uptime";
import { billingOps } from "@/lib/billing/ops";
import { billingConfig } from "@/lib/billing/stripe";
import { adminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "System status", description: "Live status of CatchUp AI: the app, the database and the AI copilot, with uptime checks and incident notes." };

const when = (iso: string | number) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type State = "up" | "degraded" | "down" | "off";
const ICON = { up: CheckCircle2, degraded: CircleAlert, down: XCircle, off: CircleDashed } as const;
const TONE = { up: "good", degraded: "warn", down: "danger", off: undefined } as const;

/** Public, live status. Checked when the page is opened; uptime history comes from the scheduled Uptime workflow. */
export default async function StatusPage() {
  const [now, r, uptime, billing] = await Promise.all([renderTime(), readiness(), uptimeHistory(48), billingOps(adminClient(), billingConfig()).catch(() => null)]);
  const components: { name: string; state: State; text: string; note: string }[] = [
    { name: "Web app", state: "up", text: "Operational", note: "This page was served by the live deployment." },
    { name: "Database", state: r.database === "ok" ? "up" : "down", text: r.database === "ok" ? `Operational · ${r.databaseMs} ms` : "Unavailable", note: "Sign-in, courses, plans and documents." },
    {
      name: "AI copilot",
      state: r.ai === "enabled" ? "up" : r.ai === "paused" ? "degraded" : "off",
      text: r.ai === "enabled" ? "Operational" : r.ai === "paused" ? "Paused by the operator" : "Not configured",
      note: "Answers with citations and drafts plans. Everything else works without it.",
    },
    {
      name: "Billing",
      state: !billing || billing.mode === "off" ? "off" : "up",
      text: !billing || billing.mode === "off" ? "Not offered yet" : billing.mode === "test" ? "Test mode" : "Operational",
      note: !billing || billing.mode === "off" ? "Paid organisation plans aren't switched on. Students never pay." : `Organisation plans through Stripe. Last payment event received: ${billing.lastWebhookAt ? when(billing.lastWebhookAt) : "none yet"}.`,
    },
  ];
  const worst: State = components.some((c) => c.state === "down") ? "down" : components.some((c) => c.state === "degraded") ? "degraded" : "up";
  const finished = uptime?.filter((u) => u.status === "completed") ?? [];
  const passed = finished.filter((u) => u.conclusion === "success").length;
  const Overall = ICON[worst];

  return (
    <div className="lp">
      <header className="lp-top">
        <Brand />
        <div className="top-actions">
          <ThemeButton />
          <ButtonLink href="/" small><ArrowLeft className="ic" aria-hidden="true" /> Home</ButtonLink>
        </div>
      </header>
      <main id="main" className="quality status-page">
        <div className="eyebrow">Live · checked {when(now)}</div>
        <h1>System status</h1>
        <p className={`status-banner ${worst}`} role="status">
          <Overall className="ic" aria-hidden="true" />
          {worst === "up" ? "All systems operational" : worst === "degraded" ? "Partly degraded: the AI copilot is paused, everything else works" : "Service disruption: some parts of the app are unavailable"}
        </p>

        <section className="card card-inner" aria-labelledby="status-components">
          <h2 id="status-components" className="trace-h2">Components</h2>
          <ul className="status-components" aria-label="Components">
            {components.map((c) => {
              const Icon = ICON[c.state];
              return (
                <li key={c.name} data-state={c.state}>
                  <Icon className="ic" aria-hidden="true" />
                  <div><strong>{c.name}</strong><p className="muted">{c.note}</p></div>
                  <Chip tone={TONE[c.state]}>{c.text}</Chip>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card card-inner" aria-labelledby="status-uptime">
          <div className="split-head"><h2 id="status-uptime" className="trace-h2">Uptime checks</h2>{finished.length ? <Chip tone={passed === finished.length ? "good" : "warn"}>{passed} of {finished.length} passed</Chip> : null}</div>
          <p className="muted">An automated check opens the live site and its readiness endpoint every 30 minutes. Newest first.</p>
          {uptime === null ? (
            <p className="muted">The check history couldn&apos;t be loaded from GitHub right now.</p>
          ) : finished.length === 0 ? (
            <p className="muted">No completed checks yet.</p>
          ) : (
            <ol className="ops-uptime" aria-label="Recent uptime checks, newest first">
              {finished.map((u) => (
                <li key={u.url} data-result={u.conclusion ?? u.status} title={`${when(u.at)} · ${u.conclusion}`}>
                  <a href={u.url} target="_blank" rel="noopener noreferrer"><span className="visually-hidden">{when(u.at)}: {u.conclusion === "success" ? "passed" : "failed"}</span></a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card card-inner" aria-labelledby="status-incidents">
          <h2 id="status-incidents" className="trace-h2">Incident notes</h2>
          <ul className="status-incidents" aria-label="Incident notes, newest first">
            {INCIDENTS.map((i) => (
              <li key={`${i.date}-${i.title}`}>
                <div className="split-head"><strong>{i.title}</strong><Chip tone={i.status === "Resolved" ? "good" : "warn"}>{i.status}</Chip></div>
                <p className="muted">{day(i.date)}</p>
                <p><b>Impact:</b> {i.impact}</p>
                <p><b>Cause:</b> {i.cause}</p>
                <p><b>Fix:</b> {i.fix}</p>
              </li>
            ))}
          </ul>
        </section>
        <p className="muted">Release {r.version}. How the app is tested and secured: <Link href="/quality">quality and trust</Link>.</p>
      </main>
    </div>
  );
}
