"use client";

import Link from "next/link";
import { ArrowRight, Gauge, Route, Timer, Users } from "lucide-react";
import { useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { STATUS_LABEL } from "@/lib/mastery/elo";
import type { MasteryMap, SessionInfo } from "@/lib/mastery/service";
import AssessmentRunner from "./assessment-runner";

/**
 * "Where you are → where you need to be → the bridge". The Diagnostician's warm-up finds the starting point; the
 * mastery map shows each concept's status with its page; the Quizmaster practises the gaps (or, opt-in, runs a
 * timed rehearsal on what's already known).
 */
export default function MasteryPanel({ documentId, initialMap }: { documentId: string; initialMap: MasteryMap }) {
  const [map, setMap] = useState(initialMap);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [lastRun, setLastRun] = useState<SessionInfo["agent"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const known = map.concepts.filter((c) => c.status === "known").length;

  async function start(kind: "diagnostic" | "practice" | "rehearsal") {
    setBusy(kind);
    setError(null);
    setScore(null);
    try {
      const url = kind === "diagnostic" ? "/api/mastery/diagnostic" : "/api/mastery/practice";
      const body = kind === "diagnostic" ? { documentId } : { documentId, mode: kind };
      const { session: s } = await api<{ session: SessionInfo }>(url, { method: "POST", body });
      setSession(s);
      setLastRun(s.agent);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't start. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function finish(result: { correct: number; total: number }) {
    setSession(null);
    setScore(result);
    try {
      const { map: m } = await api<{ map: MasteryMap }>(`/api/mastery?documentId=${documentId}`);
      setMap(m);
    } catch {
      // The map refreshes on the next page load.
    }
  }

  const agentLine = lastRun ? (
    <p className="agent-line">
      <Users className="ic" aria-hidden="true" /> Questions by the <b>{lastRun.name}</b>
      {lastRun.model ? <> ({lastRun.model}) · {lastRun.agentWritten} written by the agent{lastRun.fallback ? `, ${lastRun.fallback} fill-the-gap` : ""}</> : <> · fill-the-gap questions (AI unavailable)</>}
      {lastRun.runId ? <> · <Link href={`/runs/${lastRun.runId}`}>View its run</Link></> : null}
    </p>
  ) : null;

  return (
    <section className="card mastery-panel" aria-labelledby="mastery-head">
      <div className="split-head">
        <h3 id="mastery-head"><Gauge className="ic" aria-hidden="true" /> Where you are</h3>
        <span className="agent-team-chip">Agent team: Diagnostician · Quizmaster</span>
      </div>

      {session ? (
        <>
          {agentLine}
          <AssessmentRunner key={session.sessionId} session={session} documentId={documentId} onDone={finish} />
        </>
      ) : map.tested === 0 ? (
        <>
          <p>
            Before you study, the <b>Diagnostician</b> checks what you already know: up to {Math.min(6, Math.max(2, map.concepts.length || 6))} questions written from this
            lecture, about 3 minutes. After each one, tap how sure you are, so confident mistakes get fixed first.
          </p>
          <button type="button" className="btn primary small" onClick={() => start("diagnostic")} disabled={busy !== null}>
            {busy === "diagnostic" ? "The Diagnostician is writing your questions…" : "Start the 3-minute warm-up"}
          </button>
        </>
      ) : (
        <>
          {score ? <p className="mastery-score" aria-live="polite">You got {score.correct} of {score.total}. Here&apos;s where you are now.</p> : null}
          {agentLine}
          <ul className="mastery-map" aria-label="Your mastery map">
            {map.concepts.map((c) => (
              <li key={c.concept}>
                <span className={`mastery-chip ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                <b>{c.concept}</b>
                <a className="cite-chip" href={`/api/documents/${documentId}/source?page=${c.page}`} target="_blank" rel="noopener noreferrer">p. {c.page}</a>
              </li>
            ))}
          </ul>
          {map.bridge.length ? (
            <div className="mastery-bridge">
              <h4><Route className="ic" aria-hidden="true" /> Your bridge</h4>
              <p>Where you need to be: every concept known. Start here:</p>
              <ol>
                {map.bridge.slice(0, 3).map((c) => (
                  <li key={c.concept}><b>{c.concept}</b> ({STATUS_LABEL[c.status].toLowerCase()}, page {c.page})</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="mastery-bridge">Every concept in this lecture is known. Try a timed rehearsal, or move on to the next lecture.</p>
          )}
          <div className="mastery-actions">
            <button type="button" className="btn primary small" onClick={() => start("practice")} disabled={busy !== null}>
              {busy === "practice" ? "The Quizmaster is preparing your session…" : <>Practise my gaps with the Quizmaster <ArrowRight className="ic" aria-hidden="true" /></>}
            </button>
            <button type="button" className="btn ghost small" onClick={() => start("rehearsal")} disabled={busy !== null || known === 0} title={known === 0 ? "Opens once at least one concept is known" : "45 seconds per question, no hints"}>
              <Timer className="ic" aria-hidden="true" /> {busy === "rehearsal" ? "Preparing…" : "Timed exam rehearsal"}
            </button>
            <button type="button" className="btn ghost small" onClick={() => start("diagnostic")} disabled={busy !== null}>Check again</button>
          </div>
          {known === 0 ? <p className="muted small">Timed exam rehearsal opens once a concept is known. Timing is optional: it adds pressure, so we keep practice untimed.</p> : null}
        </>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
