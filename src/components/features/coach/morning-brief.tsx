"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, Gauge, Moon, RefreshCcw, Sprout, Timer, X } from "lucide-react";
import { useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import type { Brief, BriefCard } from "@/lib/coach/night";

const ICON: Record<BriefCard["kind"], typeof Moon> = { replan: RefreshCcw, deadline: CalendarClock, warmup: Gauge, practice: Timer, growth: Sprout };

/**
 * The Night Coach's morning brief: what a scheduled agent pipeline noticed overnight and prepared (never saved).
 * "Check now" runs it on demand; dismissing deletes the brief.
 */
export default function MorningBrief({ initial }: { initial: Brief | null }) {
  const [brief, setBrief] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function checkNow() {
    setBusy(true);
    setError(null);
    try {
      const { brief: b } = await api<{ brief: Brief }>("/api/coach/brief", { method: "POST" });
      setBrief(b);
      setDismissed(false);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "The Night Coach couldn't run. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!brief) return;
    setDismissed(true);
    try {
      await api(`/api/coach/brief?id=${brief.id}`, { method: "DELETE" });
    } catch {
      setDismissed(false);
    }
  }

  const show = brief && !dismissed;
  return (
    <section className="card morning-brief" aria-labelledby="brief-head">
      <div className="split-head">
        <h2 id="brief-head"><Moon className="ic" aria-hidden="true" /> {show ? "While you slept" : "Night Coach"}</h2>
        <div className="morning-brief-actions">
          <button type="button" className="btn small ghost" onClick={checkNow} disabled={busy}>
            <BellRing className="ic" aria-hidden="true" /> {busy ? "Checking…" : "Check now"}
          </button>
          {show ? (
            <button type="button" className="icon-btn" aria-label="Dismiss the brief" title="Dismiss" onClick={dismiss}>
              <X className="ic" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {show ? (
        brief.cards.length ? (
          <>
            <p className="muted small">
              Your Night Coach checked your deadlines, gaps and plan{brief.runId ? <> (<Link href={`/runs/${brief.runId}`}>see what it did</Link>)</> : null}. Nothing was saved: each card is yours to choose.
            </p>
            <ul className="brief-cards" aria-label="Morning brief">
              {brief.cards.map((c, i) => {
                const Icon = ICON[c.kind];
                return (
                  <li key={i} className={`brief-card ${c.kind}`}>
                    <span className="brief-icon" aria-hidden="true"><Icon className="ic" /></span>
                    <div>
                      <span className="brief-agent">{c.agent}</span>
                      <b>{c.title}</b>
                      <p>{c.body}</p>
                      <Link className="text-link" href={c.href}>Open <ArrowRight className="ic" aria-hidden="true" /></Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p>All quiet: nothing slipping, nothing due soon, no gaps waiting. Upload the next lecture when you have it.</p>
        )
      ) : (
        <p>Each night your Night Coach checks your deadlines, what you know and your plan, and has the Quizmaster prepare practice on your biggest gap. Your brief appears here in the morning.</p>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
