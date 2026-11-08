"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Pause, Play, RotateCcw, XCircle } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import type { Replay } from "@/lib/quality/replay";
import { usePreferences } from "@/lib/preferences/store";

const STEP_MS = 900;
const date = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const ERROR: Record<string, string> = { model_error: "The model provider returned an error", model_quota: "The model's daily quota ran out", model_busy: "The model was busy" };

/** Plays back a recorded real run step by step. Nothing here calls a model: it reads the committed trace. */
export default function ReplayPlayer({ replays }: { replays: Replay[] }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const { reducedMotion } = usePreferences();
  const r = replays[index];
  // Steps, then the answer, count as one more "frame". Reduced motion shows the whole run at once.
  const frames = r.steps.length + 1;
  const visible = reducedMotion ? frames : shown;
  const done = visible >= frames;

  useEffect(() => {
    if (!playing || done) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, done, shown]);

  const pick = (i: number) => {
    setIndex(i);
    setShown(0);
    setPlaying(true);
  };

  // ARIA tabs pattern: one tab stop; arrow keys, Home and End move between runs.
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: React.KeyboardEvent) => {
    const last = replays.length - 1;
    const next = ({ ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last } as Record<string, number>)[e.key];
    if (next === undefined) return;
    e.preventDefault();
    pick(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="replay">
      <div className="replay-tabs" role="tablist" aria-label="Recorded runs" onKeyDown={onTabKey}>
        {replays.map((x, i) => (
          <button key={x.id} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`tab-${x.id}`} aria-controls="replay-panel" aria-selected={i === index} tabIndex={i === index ? 0 : -1} className={i === index ? "btn small primary" : "btn small"} onClick={() => pick(i)}>
            {x.title}
          </button>
        ))}
      </div>

      <section id="replay-panel" role="tabpanel" aria-labelledby={`tab-${r.id}`} className="card replay-panel">
        <div className="replay-meta">
          <Chip>Recorded run · not live</Chip>
          <span className="muted">
            {r.model} · {date(r.recordedAt)} · {(r.latencyMs / 1000).toFixed(1)} s · {r.tokens.input.toLocaleString("en-GB")} in / {r.tokens.output.toLocaleString("en-GB")} out tokens
          </span>
        </div>
        <p className="trace-request"><b>Student asked:</b> “{r.request}”</p>

        <div className="replay-controls">
          {done ? (
            <button type="button" className="btn small" onClick={() => pick(index)}><RotateCcw className="ic" aria-hidden="true" /> Replay</button>
          ) : (
            <button type="button" className="btn small" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="ic" aria-hidden="true" /> : <Play className="ic" aria-hidden="true" />} {playing ? "Pause" : "Play"}
            </button>
          )}
          {!done ? <button type="button" className="btn small" onClick={() => { setShown(frames); setPlaying(false); }}>Show all</button> : null}
        </div>

        <h2 className="trace-h2">What the agent did</h2>
        {r.steps.length === 0 ? <p className="muted">No tool was called.</p> : null}
        <ol className="trace-steps" aria-live="polite">
          {r.steps.slice(0, visible).map((s, i) => (
            <li key={`${s.tool}-${i}`} data-status="completed">
              <span className="trace-step-no">{i + 1}</span>
              <div className="trace-step-body">
                <div className="trace-step-head"><CheckCircle2 className="ic" aria-hidden="true" /> <b>{s.label}</b></div>
                <p>{s.outcome}</p>
                <p className="trace-call">{s.tool} · {s.ms} ms</p>
              </div>
            </li>
          ))}
        </ol>

        {done ? (
          <div className="replay-result">
            <h2 className="trace-h2">What the student got</h2>
            {r.status === "failed" ? (
              <p className="replay-failed"><XCircle className="ic" aria-hidden="true" /> {ERROR[r.errorCode ?? ""] ?? "The run failed"}. The student saw a clear error; nothing was saved.</p>
            ) : null}
            {/* The verdict first: did the plan fit, and was anything saved? */}
            {r.draft ? (
              <p className="replay-verdict">
                <Chip tone={r.draft.feasible ? "good" : "warn"}>{r.draft.feasible ? "Plan fits" : `Short by ${r.draft.shortfallMinutes} min`}</Chip>{" "}
                Draft plan left for the student to approve. {r.draft.saved ? "It was saved without approval." : "Nothing was saved."}
              </p>
            ) : r.status === "completed" ? <p className="muted">No plan was drafted.</p> : null}
            {r.facts.length ? (
              <>
                <div className="label">Checked facts</div>
                <ul className="trace-cites">
                  {r.facts.map((f) => <li key={f.statement}>{f.statement} <Chip>{f.basis === "course pages" ? "cited to course pages" : "from the student's own data"}</Chip></li>)}
                </ul>
              </>
            ) : null}
            {r.citations.length ? <p className="muted">Pages cited: {r.citations.join(", ")}</p> : null}
            {r.removedFacts ? <p className="muted">The claim check removed {r.removedFacts} statement{r.removedFacts === 1 ? "" : "s"} it couldn&apos;t support.</p> : null}
            {r.suggestions.length ? (
              <>
                <div className="label">Suggestions (advice, not facts)</div>
                <ul className="trace-notes">{r.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
              </>
            ) : null}
            {r.clarifyingQuestion ? <p><b>It asked:</b> {r.clarifyingQuestion}</p> : null}
            <a className="text-link" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Raw trace on GitHub <ExternalLink className="ic" aria-hidden="true" /></a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
