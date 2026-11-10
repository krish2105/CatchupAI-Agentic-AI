"use client";

import { CheckCircle2, Clock, Lightbulb, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { STATUS_LABEL, type Confidence } from "@/lib/mastery/elo";
import type { AnswerResult, SessionInfo } from "@/lib/mastery/service";
import VoiceAnswer from "./voice-answer";

const CONFIDENCE: { value: Confidence; label: string }[] = [
  { value: "sure", label: "Sure" },
  { value: "think", label: "Think so" },
  { value: "guess", label: "Guessing" },
];

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Runs a Diagnostician warm-up or a Quizmaster session one question at a time: pick an answer, say how sure you
 * are, get feedback with the page it comes from. Hints come before answers (never in timed rehearsal). A soft
 * count-up timer is always shown; a countdown only in opt-in rehearsal.
 */
export default function AssessmentRunner({ session, documentId, onDone }: { session: SessionInfo; documentId: string; onDone: (score: { correct: number; total: number }) => void }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [correctCount, setCorrectCount] = useState(0);
  const submitted = useRef(false);
  const item = session.items[index];
  const elapsed = now - startedAt;
  const limitMs = item.timeLimitSeconds ? item.timeLimitSeconds * 1000 : null;
  const timed = limitMs !== null;

  async function submit(answer: number | null, sureness: Confidence) {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError(null);
    try {
      const { result } = await api<{ result: AnswerResult }>("/api/mastery/answer", { method: "POST", body: { itemId: item.id, chosen: answer, confidence: sureness, elapsedMs: Date.now() - startedAt } });
      setFeedback(result);
      if (result.correct) setCorrectCount((c) => c + 1);
    } catch (e) {
      submitted.current = false;
      setError(e instanceof ClientApiError ? e.message : "Couldn't check that answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // One tick per second for the soft timer; in timed rehearsal, time running out submits "no answer".
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (feedback) return;
    const handle = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (limitMs !== null && t - startedAt >= limitMs) void submitRef.current(null, "guess");
    }, 1000);
    return () => clearInterval(handle);
  }, [feedback, limitMs, startedAt]);

  async function hint() {
    const level = hints.length === 0 ? 1 : 2;
    try {
      const { hint: h } = await api<{ hint: { hint: string } }>("/api/mastery/hint", { method: "POST", body: { itemId: item.id, level } });
      setHints((list) => [...list, h.hint]);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't load a hint.");
    }
  }

  function next() {
    if (index + 1 >= session.items.length) {
      onDone({ correct: correctCount, total: session.items.length });
      return;
    }
    submitted.current = false;
    setIndex((i) => i + 1);
    setChosen(null);
    setConfidence(null);
    setFeedback(null);
    setHints([]);
    setError(null);
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
  }

  return (
    <div className="assessment" aria-labelledby="assessment-q">
      <div className="assessment-meta">
        <span>Question {index + 1} of {session.items.length} · {item.concept}</span>
        <span className={`assessment-timer${timed && limitMs! - elapsed <= 10_000 ? " urgent" : ""}`} role="timer" aria-label={timed ? "Time left" : "Time on this question"}>
          <Clock className="ic" aria-hidden="true" /> {timed ? clock(limitMs! - elapsed) : clock(elapsed)}
        </span>
      </div>
      <p id="assessment-q" className="assessment-prompt">{item.prompt}</p>
      <div className="assessment-options" role="radiogroup" aria-labelledby="assessment-q">
        {item.options.map((option, i) => {
          const state = feedback ? (i === feedback.answerIndex ? " right" : i === chosen ? " wrong" : "") : i === chosen ? " chosen" : "";
          return (
            <button key={i} type="button" role="radio" aria-checked={chosen === i} className={`assessment-option${state}`} disabled={Boolean(feedback) || busy} onClick={() => setChosen(i)}>
              <b>{String.fromCharCode(65 + i)}</b> {option}
            </button>
          );
        })}
      </div>

      {!feedback ? (
        <>
          <div className="assessment-confidence" role="radiogroup" aria-label="How sure are you?">
            <span>How sure are you?</span>
            {CONFIDENCE.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={confidence === c.value} className={`chip-toggle${confidence === c.value ? " on" : ""}`} onClick={() => setConfidence(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
          <VoiceAnswer
            options={item.options}
            onAnswer={(choice, sureness) => {
              setChosen(choice);
              if (sureness) setConfidence(sureness);
            }}
          />
          {hints.length ? (
            <ul className="assessment-hints" aria-label="Hints">
              {hints.map((h, i) => <li key={i}><Lightbulb className="ic" aria-hidden="true" /> {h}</li>)}
            </ul>
          ) : null}
          <div className="assessment-actions">
            <button type="button" className="btn primary small" disabled={chosen === null || !confidence || busy} onClick={() => submit(chosen, confidence!)}>Check my answer</button>
            {!timed && hints.length < 2 ? (
              <button type="button" className="btn ghost small" onClick={hint} disabled={busy}>
                <Lightbulb className="ic" aria-hidden="true" /> {hints.length === 0 ? "Give me a hint" : "Show the page sentence"}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className={`assessment-feedback ${feedback.correct ? "ok" : "miss"}`} aria-live="polite">
          <p>
            {feedback.correct ? <CheckCircle2 className="ic" aria-hidden="true" /> : <XCircle className="ic" aria-hidden="true" />}{" "}
            <b>{feedback.correct ? "Right." : feedback.timedOut ? "Time's up." : "Not quite."}</b>{" "}
            {feedback.correct ? "" : `The answer is ${String.fromCharCode(65 + feedback.answerIndex)}.`}
          </p>
          <blockquote>
            &ldquo;{feedback.explanation.quote}&rdquo;{" "}
            <a className="cite-chip" href={`/api/documents/${documentId}/source?page=${feedback.explanation.page}`} target="_blank" rel="noopener noreferrer">p. {feedback.explanation.page}</a>
          </blockquote>
          <p className="assessment-status">{feedback.mastery.concept}: <span className={`mastery-chip ${feedback.mastery.status}`}>{STATUS_LABEL[feedback.mastery.status]}</span></p>
          <button type="button" className="btn primary small" onClick={next}>{index + 1 >= session.items.length ? "See where you are" : "Next question"}</button>
        </div>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
