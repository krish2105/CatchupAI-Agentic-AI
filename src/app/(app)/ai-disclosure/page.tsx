import type { Metadata } from "next";
import { Download } from "lucide-react";
import PrintButton from "@/components/features/settings/print-button";
import PageHeading from "@/components/ui/page-heading";
import { requirePageUser } from "@/lib/auth/session";
import { ORIGIN_LABEL, outcomeLabel } from "@/lib/disclosure/build";
import { loadDisclosure } from "@/lib/disclosure/service";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "AI-use disclosure" };

/** What the AI drafted for this student, its sources and what they approved: for academic integrity. */
export default async function AiDisclosurePage() {
  const { supabase, user } = await requirePageUser("/ai-disclosure");
  const now = await renderTime();
  const d = await loadDisclosure(supabase, user.id, now);
  const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: d.timezone }).format(new Date(iso));
  return (
    <>
      <PageHeading
        eyebrow="Academic integrity"
        title="AI-use disclosure"
        description="Where the AI assistant helped with your studies, the pages it cited and what you approved. Attach it to coursework if your school asks how you used AI."
        actions={
          <>
            <a className="btn small" href="/api/account/ai-disclosure" download><Download className="ic" aria-hidden="true" /> Download (.md)</a>
            <PrintButton />
          </>
        }
      />
      <section className="card setting-card" aria-labelledby="disclosure-how">
        <h2 id="disclosure-how" className="answer-title">How AI is used in CatchUp</h2>
        <ul className="quality-list">
          <li>Copilot facts must cite a page from your own notes; anything that couldn&apos;t be checked is removed. Suggestions are advice.</li>
          <li>Plan numbers come from a deterministic planner, not AI. The copilot and the daily check-in only draft; nothing is saved without your approval.</li>
          <li>Catch-up packs, knowledge checks and Teach-It-Back feedback are built without AI.</li>
        </ul>
      </section>

      <section className="card setting-card section-space" aria-labelledby="disclosure-runs">
        <h2 id="disclosure-runs" className="answer-title">Copilot answers ({d.runs.length})</h2>
        {d.runs.length ? (
          <ol className="disclosure-list">
            {d.runs.map((r, i) => (
              <li key={i}>
                <p className="muted">{when(r.createdAt)}{r.model ? ` · ${r.model}` : ""}</p>
                <p><strong>Question:</strong> {r.question}</p>
                {r.offTopic ? <p className="muted">Outside what the copilot helps with; no answer was given.</p> : null}
                {r.facts.length ? (
                  <ul>{r.facts.map((f, j) => <li key={j}>{f.statement}{f.sources.length ? ` (${f.sources.map((s) => `${s.filename}, p. ${s.page}`).join("; ")})` : ""}</li>)}</ul>
                ) : null}
                {r.suggestions.length && !r.offTopic ? <p className="muted">Suggestions (advice): {r.suggestions.join(" ")}</p> : null}
              </li>
            ))}
          </ol>
        ) : <p className="muted">No copilot answers yet.</p>}
      </section>

      <section className="card setting-card section-space" aria-labelledby="disclosure-plans">
        <h2 id="disclosure-plans" className="answer-title">Study plans drafted ({d.plans.length})</h2>
        {d.plans.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th scope="col">Drafted</th><th scope="col">By</th><th scope="col">Route</th><th scope="col">Outcome</th></tr></thead>
              <tbody>{d.plans.map((p, i) => <tr key={i}><td>{when(p.createdAt)}</td><td>{ORIGIN_LABEL[p.origin]}</td><td>{p.scenario}</td><td>{outcomeLabel(p.status, p.decidedAt, when)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="muted">No plans drafted yet.</p>}
      </section>

      <section className="card setting-card section-space" aria-labelledby="disclosure-memories">
        <h2 id="disclosure-memories" className="answer-title">Notes the copilot suggested and you kept ({d.memories.length})</h2>
        {d.memories.length ? <ul className="quality-list">{d.memories.map((m, i) => <li key={i}>{m.text} <span className="muted">({when(m.createdAt)})</span></li>)}</ul> : <p className="muted">None.</p>}
      </section>
    </>
  );
}
