"use client";

import { Check, FileText, MessageSquareQuote, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ConceptCheck, TeachFeedback } from "@/lib/teach/feedback";
import type { TeachAttempt } from "@/lib/teach/service";

const MIN_WORDS = 25;
const LEVEL = { strong: "Strong explanation", developing: "Good start", starting: "Let's build it up" } as const;
const PRACTISABLE = /^[A-Za-z][A-Za-z_-]{1,39}$/;

type Result = TeachFeedback & { id: string; courseId: string; topic: string };

/**
 * Teach-It-Back: the student explains a topic; the server checks the explanation against key concepts in
 * their own notes and cites the page for each. Missing concepts feed straight into a targeted retest.
 */
export default function TeachBack({
  courses,
  history,
  busy,
  onPractice,
}: {
  courses: { id: string; title: string }[];
  history: TeachAttempt[];
  busy: boolean;
  onPractice: (courseId: string, terms: string[]) => void;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const titles = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (topic.trim().length < 2) return setError("Name the topic you're explaining.");
    if (!text.trim()) return setError("Write your explanation first.");
    setChecking(true);
    setError(null);
    try {
      const res = await api<{ attempt: TeachFeedback & { id: string } }>("/api/teach-back", { method: "POST", body: { courseId, topic: topic.trim(), explanation: text.trim() } });
      setResult({ ...res.attempt, courseId, topic: topic.trim() });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't check your explanation.");
    } finally {
      setChecking(false);
    }
  }

  const missing = (result?.concepts ?? []).filter((c) => !c.covered);
  const practise = missing.map((c) => c.term).filter((t) => PRACTISABLE.test(t)).slice(0, 5);

  return (
    <section className="card teach-card" aria-labelledby="teach-head">
      <div className="teach-intro">
        <span className="teach-icon" aria-hidden="true"><MessageSquareQuote className="ic" /></span>
        <div>
          <div className="label">Teach it back</div>
          <h3 id="teach-head">Explain it in your own words</h3>
          <p>Explaining a topic shows what you really understand. Your explanation is checked against the key concepts in your own notes, with the page for each. No AI is involved, and it doesn&apos;t judge whether every sentence is correct.</p>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="nf-empty">Upload and index a text-based PDF in the knowledge vault first.</p>
      ) : (
        <form className="teach-form" onSubmit={check} noValidate>
          <div className="teach-row">
            <div className="field">
              <label htmlFor="teach-course">Course to explain</label>
              <select id="teach-course" className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="teach-topic">Topic to explain</label>
              <input id="teach-topic" className="input" placeholder="residuals" maxLength={120} value={topic} onChange={(e) => { setTopic(e.target.value); setError(null); }} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="teach-text">Your explanation</label>
            <textarea id="teach-text" className="textarea" rows={6} maxLength={4000} placeholder="Explain it as if to a classmate who missed the lecture…" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} aria-describedby="teach-count" />
            <span id="teach-count" className={`teach-count${words > 0 && words < MIN_WORDS ? " short" : ""}`}>{words} word{words === 1 ? "" : "s"}{words < MIN_WORDS ? ` · aim for at least ${MIN_WORDS}` : ""}</span>
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={checking} style={{ justifySelf: "start" }}>
            {checking ? <span className="spinner" aria-hidden="true" /> : <Check className="ic" aria-hidden="true" />} Check my explanation
          </button>
        </form>
      )}

      {result ? (
        <div className="teach-result" aria-live="polite" aria-label="Teach-back feedback">
          <div className="teach-score">
            <div className="teach-meter" role="img" aria-label={`${result.coveragePercent}% of key concepts covered`}>
              <span style={{ width: `${result.coveragePercent}%` }} />
            </div>
            <strong>{result.coveragePercent}% of key concepts</strong>
            <Chip tone={result.level === "strong" ? "good" : "warn"}>{LEVEL[result.level]}</Chip>
            {result.wordCount < MIN_WORDS ? <span className="muted">Short explanations stay at “Let&apos;s build it up”; aim for {MIN_WORDS}+ words.</span> : null}
          </div>
          <ul className="teach-concepts" aria-label="Key concepts from your notes">
            {result.concepts.map((c) => <Concept key={c.term} concept={c} />)}
          </ul>
          {missing.length ? (
            <div className="teach-next">
              <span>Next step: practise the {missing.length === 1 ? "concept" : "concepts"} you didn&apos;t mention.</span>
              {practise.length ? (
                <button type="button" className="btn small primary" disabled={busy} onClick={() => onPractice(result.courseId, practise)}>
                  <Repeat className="ic" aria-hidden="true" /> Practise {practise.length} missing
                </button>
              ) : null}
            </div>
          ) : (
            <Notice title="You covered every key concept from your notes. Try explaining a harder topic next." />
          )}
        </div>
      ) : null}

      {history.length ? (
        <div className="teach-history">
          <div className="label">Recent explanations</div>
          <ul aria-label="Recent explanations">
            {history.map((h) => (
              <li key={h.id}>
                <span>{h.topic} <span className="muted">· {titles[h.courseId] ?? "Course"}</span></span>
                <b>{h.coveragePercent}%</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Concept({ concept }: { concept: ConceptCheck }) {
  const href = `/api/documents/${concept.citation.documentId}/source?page=${concept.citation.page}`;
  return (
    <li className={concept.covered ? "covered" : "missing"}>
      <span className="teach-mark" aria-hidden="true">{concept.covered ? <Check className="ic" /> : "?"}</span>
      <span className="teach-body">
        <strong>{concept.term}</strong> <span className="visually-hidden">{concept.covered ? "covered" : "not mentioned"}</span>
        {!concept.covered && concept.quote ? <q>{concept.quote}</q> : null}
        <a className="cite-chip" href={href} target="_blank" rel="noopener noreferrer"><FileText className="ic" aria-hidden="true" /> {concept.citation.filename} · p. {concept.citation.page}</a>
      </span>
    </li>
  );
}
