import { activationFunnel } from "@/lib/activation/service";
import type { Metadata } from "next";
import { AiControls, ResolveButton } from "@/components/features/ops/ops-controls";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { opsSnapshot, requireOpsOwnerPage, uptimeHistory } from "@/lib/ops/service";
import { renderTime } from "@/lib/server/clock";
import { adminClient } from "@/lib/supabase/admin";
import { billingOps } from "@/lib/billing/ops";
import { billingConfig } from "@/lib/billing/stripe";

export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Owner-only operations page (OPS_OWNER_EMAILS). Anyone else gets a not-found. Reads with the service role
 * after the owner check: AI switch and budget, today's runs, open error groups and recent uptime checks.
 */
export default async function OpsPage() {
  await requireOpsOwnerPage();
  const now = await renderTime();
  const [snap, uptime, funnel, billing] = await Promise.all([opsSnapshot(adminClient(), now), uptimeHistory(), activationFunnel(adminClient(), { since: new Date(now - 30 * 86400_000).toISOString() }), billingOps(adminClient(), billingConfig())]);
  const used = snap.ai.budget > 0 ? Math.min(100, Math.round((snap.ai.tokensToday / snap.ai.budget) * 100)) : 100;
  const aiOn = snap.ai.enabled && !snap.ai.envKillSwitch;
  const okRuns = uptime?.filter((r) => r.conclusion === "success").length ?? 0;
  const finished = uptime?.filter((r) => r.status === "completed").length ?? 0;

  return (
    <>
      <PageHeading eyebrow="Owner only · times in GST" title="Operations" description="Switch AI off in an emergency, watch today's spend, and work through new errors. Every value here is read live from the database or GitHub." />
      <div className="ops-grid">
        <section className="card card-inner" aria-labelledby="ops-ai">
          <div className="split-head"><h2 id="ops-ai" className="trace-h2">AI</h2><Chip tone={aiOn ? "good" : "danger"}>{aiOn ? "On" : "Paused"}</Chip></div>
          {snap.ai.envKillSwitch ? <p className="muted">Paused by the <code>AI_KILL_SWITCH</code> environment variable, which overrides the switch below.</p> : null}
          <p><b>{snap.ai.tokensToday.toLocaleString("en-GB")}</b> of {snap.ai.budget.toLocaleString("en-GB")} tokens used today (UTC day)</p>
          <div className="ops-meter" role="meter" aria-label="Share of today's token budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={used}><span style={{ width: `${used}%` }} /></div>
          <p className="muted">Runs today: {snap.runsToday.total} · failed {snap.runsToday.failed} · fell back to the second model {snap.runsToday.fellBack} · tool calls served from cache {snap.runsToday.cachedCalls}</p>
          <AiControls initial={{ enabled: snap.ai.enabled, budget: snap.ai.budget, note: snap.ai.note }} />
        </section>

        <section className="card card-inner" aria-labelledby="ops-uptime">
          <div className="split-head"><h2 id="ops-uptime" className="trace-h2">Uptime checks</h2>{uptime ? <Chip tone={okRuns === finished ? "good" : "warn"}>{okRuns}/{finished} passed</Chip> : null}</div>
          {uptime === null ? (
            <p className="muted">Couldn&apos;t reach GitHub right now. The checks run every 30 minutes in the Uptime workflow.</p>
          ) : uptime.length === 0 ? (
            <p className="muted">No uptime runs yet.</p>
          ) : (
            <ol className="ops-uptime" aria-label="Recent uptime checks, newest first">
              {uptime.map((r) => (
                <li key={r.url} data-result={r.conclusion ?? r.status} title={`${when(r.at)} · ${r.conclusion ?? r.status}`}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer"><span className="visually-hidden">{when(r.at)}: {r.conclusion ?? r.status}</span></a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card card-inner ops-wide" aria-labelledby="ops-funnel">
          <div className="split-head"><h2 id="ops-funnel" className="trace-h2">Activation, last 30 days</h2><Chip>{funnel.signups} new accounts</Chip></div>
          <p className="muted">Full accounts only (demo accounts excluded), read from existing rows: no tracking scripts. Activated = an approved plan and at least one finished study block.</p>
          <p>
            <b>{funnel.activated}</b> activated{funnel.activationRate === null ? "" : ` (${funnel.activationRate}%)`} · median time from sign-up to the first approved plan:{" "}
            <b>{funnel.medianMinutesToFirstPlan === null ? "no plans yet" : funnel.medianMinutesToFirstPlan < 120 ? `${funnel.medianMinutesToFirstPlan} min` : `${Math.round(funnel.medianMinutesToFirstPlan / 60)} h`}</b>
          </p>
          <table className="data-table">
            <caption className="visually-hidden">Accounts reaching each getting-started step</caption>
            <thead><tr><th scope="col">Step</th><th scope="col">Accounts</th><th scope="col">Share</th></tr></thead>
            <tbody>
              {funnel.steps.map((s) => <tr key={s.id}><td>{s.title}</td><td>{s.accounts}</td><td>{funnel.signups ? `${Math.round((s.accounts / funnel.signups) * 100)}%` : "—"}</td></tr>)}
            </tbody>
          </table>
        </section>

        <section className="card card-inner ops-wide" aria-labelledby="ops-billing">
          <div className="split-head"><h2 id="ops-billing" className="trace-h2">Billing</h2><Chip tone={billing.mode === "off" ? undefined : billing.mode === "test" ? "warn" : "good"}>{billing.mode === "off" ? "Off" : billing.mode === "test" ? "Stripe test mode" : "Stripe live"}</Chip></div>
          <p>Organisations: {billing.plans.free} free · {billing.plans.class} on the Class plan{billing.plans.pastDue ? ` · ${billing.plans.pastDue} payment overdue` : ""}. Last webhook: {billing.lastWebhookAt ? when(billing.lastWebhookAt) : "none received"}. Rejected webhooks (bad signatures) are logged as <code>billing.webhook_rejected</code>; route failures appear under error groups.</p>
          {billing.recentEvents.length ? (
            <table className="data-table">
              <caption className="visually-hidden">Recent Stripe events, newest first</caption>
              <thead><tr><th scope="col">Received</th><th scope="col">Event</th><th scope="col">Organisation</th></tr></thead>
              <tbody>{billing.recentEvents.map((e) => <tr key={e.id}><td>{when(e.receivedAt)}</td><td><code>{e.type}</code></td><td>{e.orgName ?? "deleted"}</td></tr>)}</tbody>
            </table>
          ) : <p className="muted">No Stripe events processed yet.</p>}
        </section>

        <section className="card card-inner ops-wide" aria-labelledby="ops-errors">
          <div className="split-head"><h2 id="ops-errors" className="trace-h2">Open error groups</h2><Chip tone={snap.errorGroups.length ? "warn" : "good"}>{snap.errorGroups.length}</Chip></div>
          {snap.errorGroups.length === 0 ? (
            <p className="muted">No open errors. New ones also arrive by email through the Error alerts workflow.</p>
          ) : (
            <ul className="ops-errors" aria-label="Open error groups, most recent first">
              {snap.errorGroups.map((g) => (
                <li key={g.fingerprint}>
                  <div className="ops-error-head">
                    <Chip>{g.source}</Chip>
                    <strong>{g.errorName}</strong>
                    <code>{g.path}</code>
                    <span className="muted">×{g.count} · first {when(g.firstSeen)} · last {when(g.lastSeen)}{g.release ? ` · ${g.release}` : ""}</span>
                    <ResolveButton fingerprint={g.fingerprint} />
                  </div>
                  <p>{g.message}</p>
                  {g.stack ? <details><summary>Stack (first frames, redacted)</summary><pre>{g.stack}</pre></details> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
