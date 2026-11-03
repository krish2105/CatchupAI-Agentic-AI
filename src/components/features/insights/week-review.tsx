"use client";

import { ArrowRight, Check, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { Reflection, WeekReview as Review } from "@/lib/insights/week";

const PROMPTS = [
  { key: "wentWell", label: "What went well this week?", placeholder: "Finished the residuals worksheet early." },
  { key: "wasHard", label: "What got in the way?", placeholder: "Two shifts at work on Wednesday." },
  { key: "nextFocus", label: "One focus for next week", placeholder: "Start the report draft on Monday." },
] as const;

/** Weekly review: this week's real numbers, three next steps they imply, and the student's own reflection. */
export default function WeekReview({ review }: { review: Review }) {
  const [draft, setDraft] = useState<Reflection>(review.reflection ?? { weekStart: review.weekStart, wentWell: "", wasHard: "", nextFocus: "" });
  const [saved, setSaved] = useState(Boolean(review.reflection));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = review.stats;
  const label = new Date(`${review.weekStart}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (![draft.wentWell, draft.wasHard, draft.nextFocus].some((v) => v.trim())) return setError("Write at least one line first.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/reflections", { method: "PUT", body: draft });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't save your reflection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card week-review" aria-labelledby="week-head">
      <div className="week-review-head">
        <div>
          <div className="label">Week of {label}</div>
          <h2 id="week-head">Your weekly review</h2>
        </div>
      </div>
      <ul className="week-stats" aria-label="This week">
        <li><strong>{s.blocksCompleted}</strong><span>blocks done</span></li>
        <li><strong>{s.blocksMissed}</strong><span>missed</span></li>
        <li><strong>{s.focusMinutes}</strong><span>focus minutes</span></li>
        <li><strong>{s.dueRevision}</strong><span>concepts due</span></li>
      </ul>
      <div className="week-columns">
        <div>
          <h3>Next steps</h3>
          <ol className="week-recs" aria-label="Recommended next steps">
            {review.recommendations.map((r) => (
              <li key={r.title}>
                <Link href={r.href}><strong>{r.title}</strong><span>{r.reason}</span><ArrowRight className="ic" aria-hidden="true" /></Link>
              </li>
            ))}
          </ol>
          <p className="muted week-note">Worked out from your week&apos;s numbers, not by AI.</p>
        </div>
        <form className="week-form" onSubmit={save} noValidate>
          <h3><NotebookPen className="ic" aria-hidden="true" /> Reflect</h3>
          {PROMPTS.map((p) => (
            <div className="field" key={p.key}>
              <label htmlFor={`reflect-${p.key}`}>{p.label}</label>
              <textarea id={`reflect-${p.key}`} className="textarea" rows={2} maxLength={600} placeholder={p.placeholder} value={draft[p.key]} onChange={(e) => { setDraft({ ...draft, [p.key]: e.target.value }); setSaved(false); setError(null); }} />
            </div>
          ))}
          {error ? <Notice tone="danger" title={error} /> : null}
          <button type="submit" className="btn primary small" disabled={busy} style={{ justifySelf: "start" }}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Check className="ic" aria-hidden="true" />} {saved ? "Saved" : "Save reflection"}
          </button>
        </form>
      </div>
      {review.history.length ? (
        <details className="week-history">
          <summary>Earlier reflections ({review.history.length})</summary>
          <ul>
            {review.history.map((h) => (
              <li key={h.weekStart}><b>{new Date(`${h.weekStart}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b> {[h.wentWell, h.wasHard, h.nextFocus].filter(Boolean).join(" · ")}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
