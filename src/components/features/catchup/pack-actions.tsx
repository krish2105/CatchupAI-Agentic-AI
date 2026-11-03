"use client";

import { CalendarPlus, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { PackQuestion } from "@/lib/catchup/pack";

/** Self-check: pick an answer, see whether it's right and which page explains it. Not graded or stored. */
export function CheckQuestions({ questions }: { questions: PackQuestion[] }) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const correct = Object.entries(picked).filter(([i, v]) => questions[Number(i)].answer === v).length;
  return (
    <div className="pack-questions">
      <ol aria-label="Check questions">
        {questions.map((q, i) => {
          const choice = picked[i];
          return (
            <li key={i}>
              <p>{q.prompt}</p>
              <div className="pack-options" role="group" aria-label={`Answers for question ${i + 1}`}>
                {q.options.map((o) => {
                  const state = choice ? (o === q.answer ? "right" : o === choice ? "wrong" : "") : "";
                  return (
                    <button key={o} type="button" className={`pack-option ${state}`} disabled={Boolean(choice)} onClick={() => setPicked({ ...picked, [i]: o })} aria-pressed={choice === o}>
                      {state === "right" ? <Check className="ic" aria-hidden="true" /> : state === "wrong" ? <X className="ic" aria-hidden="true" /> : null} {o}
                    </button>
                  );
                })}
              </div>
              {choice ? <span className="muted pack-feedback">{choice === q.answer ? "Correct." : `The answer is “${q.answer}”.`} See p. {q.page}.</span> : null}
            </li>
          );
        })}
      </ol>
      {Object.keys(picked).length === questions.length && questions.length ? <p className="pack-score" role="status">{correct} of {questions.length} correct</p> : null}
    </div>
  );
}

/** Drafts a plan with this catch-up block and opens it in the lab for approval (nothing is saved here). */
export function AddToPlan({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function draft() {
    setBusy(true);
    setError(null);
    try {
      const { proposal } = await api<{ proposal: { id: string } }>("/api/catchup/plan", { method: "POST", body: { documentId } });
      router.push(`/recovery?proposal=${proposal.id}`);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't draft the plan.");
      setBusy(false);
    }
  }
  return (
    <div className="pack-add">
      <button type="button" className="btn primary" onClick={draft} disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <CalendarPlus className="ic" aria-hidden="true" />} Add a 30-minute catch-up to my plan
      </button>
      <span className="muted">Opens the draft in the Recovery lab. Nothing changes until you approve.</span>
      {error ? <Notice tone="danger" title={error} /> : null}
    </div>
  );
}
