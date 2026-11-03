import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, ExternalLink, XCircle } from "lucide-react";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import { ButtonLink, Chip } from "@/components/ui/primitives";
import { ciStatus, feedbackSummary, GITHUB_REPO, health } from "@/lib/quality/live";
import snapshot from "@/lib/quality/snapshot.json";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "Quality and trust", description: "How CatchUp AI is tested, evaluated and secured, with live status." };

const CATEGORY: Record<string, string> = { retrieval: "Retrieval cites the right page", schedule: "Schedules respect time and deadlines", tool_selection: "Copilot picks the right tools", approval: "Approval saves exactly once", security: "Cross-account and injection attacks blocked" };
const KIND: Record<string, string> = { answer: "Copilot answers", plan: "Study plans", pack: "Catch-up packs", teach: "Teach-it-back" };
const date = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

/** Public evidence page: every number comes from the repository at build time or a live check at request time. */
export default async function QualityPage() {
  const [ci, live, feedback, ai] = await Promise.all([ciStatus(), health(), feedbackSummary(), aiRuntimeStatus()]);
  const t = snapshot.tests;
  const e = snapshot.eval;
  const CiIcon = ci.state === "passed" ? CheckCircle2 : ci.state === "failed" ? XCircle : CircleDashed;
  return (
    <div className="lp">
      <header className="lp-top">
        <Brand />
        <div className="top-actions">
          <ThemeButton />
          <ButtonLink href="/" small><ArrowLeft className="ic" aria-hidden="true" /> Home</ButtonLink>
        </div>
      </header>
      <main id="main" className="quality">
        <div className="eyebrow">Quality and trust</div>
        <h1>How we know it works.</h1>
        <p className="quality-lead">Counts come from the code that is deployed; status checks run when you open this page. Nothing here is typed in by hand.</p>

        <section className="quality-grid" aria-label="Status">
          <div className="card quality-tile">
            <div className="label">Continuous integration · {ci.scope}</div>
            <p className={`quality-big ${ci.state}`}><CiIcon className="ic" aria-hidden="true" /> {ci.state === "passed" ? "All checks passed" : ci.state === "failed" ? "A check failed" : ci.state === "running" ? "Running now" : "Status unavailable"}</p>
            <p className="muted">Typecheck, lint, unit, integration, end-to-end, evaluation and dependency audit run on every push.{ci.at ? ` Updated ${date(ci.at)}.` : ""}</p>
            {ci.url ? <a className="text-link" href={ci.url} target="_blank" rel="noopener noreferrer">Open the run <ExternalLink className="ic" aria-hidden="true" /></a> : null}
          </div>
          <div className="card quality-tile">
            <div className="label">Live health</div>
            <ul className="quality-list">
              <li><Chip tone={live.database === "ok" ? "good" : "danger"}>{live.database === "ok" ? "Up" : "Down"}</Chip> Database · {live.databaseMs} ms round trip</li>
              <li><Chip tone={ai.configured && ai.kind !== "scripted" ? "good" : "warn"}>{ai.configured && ai.kind !== "scripted" ? "On" : "Off"}</Chip> AI copilot{ai.model && ai.kind !== "scripted" ? ` · ${ai.model}` : ""}</li>
              <li><Chip tone={live.botCheck ? "good" : "warn"}>{live.botCheck ? "On" : "Off"}</Chip> Bot check on sign-in and demo</li>
              <li><Chip tone={live.email ? "good" : "warn"}>{live.email ? "On" : "Off"}</Chip> Opt-in study emails</li>
            </ul>
          </div>
        </section>

        <section className="card quality-section" aria-labelledby="q-tests">
          <h2 id="q-tests">Automated tests</h2>
          <div className="quality-stats">
            <div><b>{t.unit}</b><span>unit</span></div>
            <div><b>{t.integration}</b><span>integration (real database, two students)</span></div>
            <div><b>{t.e2e}</b><span>end-to-end in a real browser</span></div>
          </div>
          <p className="muted">Test definitions in the repository; a few loop over screen sizes and themes, so more cases run than are listed. Integration tests sign in as two real students and check that neither can read or change the other&apos;s data.</p>
        </section>

        <section className="card quality-section" aria-labelledby="q-eval">
          <h2 id="q-eval">Evaluation suite</h2>
          <p><b>{e.totals.pass} passed</b> · {e.totals.fail} failed · {e.totals.skipped} need a live AI model · of {e.totals.cases} cases. Last run {date(e.ranAt)}.</p>
          <table className="data-table">
            <thead><tr><th scope="col">What is checked</th><th scope="col">Pass</th><th scope="col">Fail</th><th scope="col">Skipped</th></tr></thead>
            <tbody>{e.categories.map((c) => <tr key={c.category}><td>{CATEGORY[c.category] ?? c.category}</td><td>{c.pass}/{c.total}</td><td>{c.fail}</td><td>{c.skipped}</td></tr>)}</tbody>
          </table>
          <p className="muted">Skipped cases need a real model and are never simulated. Retrieval: {e.retrievalMode}.</p>
        </section>

        <section className="card quality-section" aria-labelledby="q-sec">
          <h2 id="q-sec">Security</h2>
          <ul className="quality-list">
            <li>Row-level security on all {snapshot.security.tablesWithRls} tables; every query is scoped to the signed-in student.</li>
            <li>The AI only drafts. Saving a plan needs the student&apos;s approval and commits exactly once.</li>
            <li>{snapshot.security.rateLimitBuckets} rate-limit buckets enforced in the database, with smaller budgets for demo accounts.</li>
            <li>Per-request content security policy, same-origin checks on every change, and a bot check before sign-in and demos.</li>
            <li>Uploaded documents are treated as untrusted: instructions inside them are ignored, and answers cite only pages that were retrieved.</li>
            <li>Dependency audit blocks any high-severity vulnerability in CI.</li>
          </ul>
          <p><a className="text-link" href={`https://github.com/${GITHUB_REPO}/blob/main/SECURITY_AUDIT.md`} target="_blank" rel="noopener noreferrer">Security audit</a> · <a className="text-link" href={`https://github.com/${GITHUB_REPO}/blob/main/THREAT_MODEL.md`} target="_blank" rel="noopener noreferrer">Threat model</a></p>
        </section>

        <section className="card quality-section" aria-labelledby="q-feedback">
          <h2 id="q-feedback">What students say</h2>
          {feedback && feedback.ratings > 0 ? (
            <>
              <p><b>{Math.round((feedback.helpful / feedback.ratings) * 100)}% helpful</b> across {feedback.ratings} rating{feedback.ratings === 1 ? "" : "s"} (👍/👎 in the app).</p>
              <ul className="quality-list">{feedback.byKind.filter((k) => k.ratings).map((k) => <li key={k.kind}>{KIND[k.kind]}: {k.helpful}/{k.ratings} helpful</li>)}</ul>
            </>
          ) : <p className="muted">No ratings yet. Students can rate answers, plans and packs with 👍/👎; only totals are shown here.</p>}
        </section>
      </main>
      <footer className="lp-foot">
        <span>CatchUp AI · open source on <a href={`https://github.com/${GITHUB_REPO}`} target="_blank" rel="noopener noreferrer">GitHub</a></span>
        <Link href="/">Back to the home page</Link>
      </footer>
    </div>
  );
}
