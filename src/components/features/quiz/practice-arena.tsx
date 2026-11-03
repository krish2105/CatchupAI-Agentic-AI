"use client";

import { ArrowRight, CheckCircle2, FileText, RotateCcw, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { PublicQuestion, QuizResult, QuizSummary } from "@/lib/quiz/service";

type ActiveQuiz = { id: string; title: string; topic: string; questions: PublicQuestion[] };
const LETTERS = ["A", "B", "C", "D"];

function Runner({ quiz, onDone }: { quiz: ActiveQuiz; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = quiz.questions[index];
  const chosen = answers[index];
  const last = index === quiz.questions.length - 1;

  async function next() {
    if (!last) return setIndex(index + 1);
    setBusy(true);
    setError(null);
    try {
      setResult((await api<{ result: QuizResult }>(`/api/quizzes/${quiz.id}/submit`, { method: "POST", body: { answers } })).result);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't grade the quiz.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const correct = result.results.filter((r) => r.correct).length;
    return (
      <div className="card quiz-card" aria-live="polite">
        <div className="quiz-top"><span className="label">Results · saved</span><Chip tone={result.scorePercent >= 80 ? "good" : "warn"}>{correct} / {result.results.length} correct</Chip></div>
        <div className="quiz-question" style={{ marginTop: 18 }}>You scored {Math.round(result.scorePercent)}%.</div>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }} aria-label="Answers with sources">
          {result.results.map((r, i) => {
            const question = quiz.questions[i];
            return (
              <li key={r.questionId} className="notice" style={{ display: "flex" }}>
                {r.correct ? <CheckCircle2 className="ic" aria-hidden="true" style={{ color: "var(--good)" }} /> : <XCircle className="ic" aria-hidden="true" style={{ color: "var(--danger)" }} />}
                <div>
                  <strong>{r.correct ? "Correct" : `Answer: ${question.options[r.correctIndex]}`}</strong>
                  <span>“{r.explanation}”</span>{" "}
                  <a className="text-link" style={{ display: "inline-flex", padding: 0 }} href={`/api/documents/${r.evidence.documentId}/source?page=${r.evidence.page}`} target="_blank" rel="noopener noreferrer">
                    <FileText className="ic" aria-hidden="true" /> {r.evidence.filename} · p. {r.evidence.page}
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
        {result.weakTerms.length ? (
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="label">Review next:</span>
            {result.weakTerms.map((t) => <Chip key={t} tone="warn">{t}</Chip>)}
            <Link className="btn small" href="/assistant"><Sparkles className="ic" aria-hidden="true" /> Ask the copilot</Link>
          </div>
        ) : null}
        <div className="quiz-foot"><span className="muted" style={{ fontSize: 11 }}>Every attempt is saved to Your momentum.</span><button type="button" className="btn primary small" onClick={onDone}>Done</button></div>
      </div>
    );
  }

  return (
    <div className="card quiz-card">
      <div className="quiz-top"><span className="label">Question {String(index + 1).padStart(2, "0")} of {String(quiz.questions.length).padStart(2, "0")}</span><Chip>{quiz.topic}</Chip></div>
      <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / quiz.questions.length) * 100}%` }} /></div>
      <div className="quiz-question" id={`q-${q.id}`}>{q.prompt}</div>
      <div role="radiogroup" aria-labelledby={`q-${q.id}`}>
        {q.options.map((option, i) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={chosen === i}
            className={`answer${chosen === i ? " selected" : ""}`}
            onClick={() => setAnswers((a) => { const next = [...a]; next[index] = i; return next; })}
          >
            <b aria-hidden="true">{LETTERS[i]}</b> {option}
          </button>
        ))}
      </div>
      {error ? <Notice tone="danger" title={error} /> : null}
      <div className="quiz-foot">
        <span className="muted" style={{ fontSize: 11 }}>From {q.evidence.filename}, page {q.evidence.page}. No pressure.</span>
        <button type="button" className="btn primary small" disabled={chosen === undefined || busy} onClick={next}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null} {last ? "Submit answers" : "Next question"} <ArrowRight className="ic" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function PracticeArena({ courses, quizzes }: { courses: { id: string; title: string; ready: boolean }[]; quizzes: QuizSummary[] }) {
  const router = useRouter();
  const usable = courses.filter((c) => c.ready);
  const [courseId, setCourseId] = useState(usable[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [active, setActive] = useState<ActiveQuiz | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ quiz: ActiveQuiz }>("/api/quizzes/generate", { method: "POST", body: { courseId, topic: topic.trim() || null } });
      setActive(res.quiz);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't generate a check.");
    } finally {
      setBusy(false);
    }
  }

  async function retake(id: string) {
    setError(null);
    try {
      setActive((await api<{ quiz: ActiveQuiz }>(`/api/quizzes/${id}`)).quiz);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't open that check.");
    }
  }

  if (active) {
    return (
      <div className="quiz-wrap">
        <Runner key={active.id} quiz={active} onDone={() => { setActive(null); router.refresh(); }} />
      </div>
    );
  }

  return (
    <div className="two-column">
      <div className="card card-inner">
        <div className="split-head"><h3>New knowledge check</h3><Chip>From your notes</Chip></div>
        {usable.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>Upload and index a text-based PDF in the knowledge vault first.</p>
        ) : (
          <form onSubmit={generate} style={{ display: "grid", gap: 14 }}>
            <div className="field">
              <label htmlFor="quiz-course">Course</label>
              <select id="quiz-course" className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {usable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quiz-topic">Topic (optional)</label>
              <input id="quiz-topic" className="input" maxLength={120} placeholder="e.g. residuals" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <span className="field-hint">Five fill-in-the-blank questions built from sentences in your own indexed notes, each linked to its page. Generated deterministically (no AI).</span>
            </div>
            <button className="btn primary" type="submit" disabled={busy || !courseId}>{busy ? <span className="spinner" aria-hidden="true" /> : null} Generate check</button>
          </form>
        )}
        {error ? <div style={{ marginTop: 12 }}><Notice tone="danger" title={error} /></div> : null}
      </div>
      <div className="card card-inner">
        <div className="split-head"><h3>Previous checks</h3><Chip>{quizzes.length}</Chip></div>
        {quizzes.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>No checks yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Previous checks">
            {quizzes.map((q) => (
              <li key={q.id} className="task-item">
                <span style={{ display: "grid", gap: 3 }}>
                  <span>{q.topic}</span>
                  <span className="muted" style={{ fontSize: 10 }}>{q.title} · {q.attempts} attempt{q.attempts === 1 ? "" : "s"}</span>
                </span>
                <span style={{ gap: 8 }}>
                  {q.latestScore === null ? <Chip>Not taken</Chip> : <Chip tone={q.latestScore >= 80 ? "good" : "warn"}>{Math.round(q.latestScore)}%</Chip>}
                  <button type="button" className="icon-btn" aria-label={`Take “${q.topic}” again`} onClick={() => retake(q.id)}><RotateCcw className="ic" aria-hidden="true" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
