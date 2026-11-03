"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";

type Kind = "plan" | "answer" | "pack" | "teach";

/** "Was this helpful?" 👍/👎, with an optional note after a thumbs-down. Stored as the student's own feedback. */
export default function Thumbs({ kind, refId, question = "Was this helpful?" }: { kind: Kind; refId?: string; question?: string }) {
  const page = usePathname();
  const noteId = useId();
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "noted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setState("busy");
    setError(null);
    try {
      await api("/api/feedback", { method: "POST", body: { kind, ...(refId ? { ref: refId } : {}), page, ...body } });
      return true;
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't save your feedback.");
      setState("error");
      return false;
    }
  }

  async function rate(value: 1 | -1) {
    if (rating !== null) return;
    if (await post({ rating: value })) { setRating(value); setState("idle"); }
  }

  async function sendNote() {
    if (!note.trim()) return;
    if (await post({ comment: note.trim() })) setState("noted");
  }

  return (
    <div className="thumbs" role="group" aria-label={question}>
      {rating === null ? (
        <>
          <span className="thumbs-q">{question}</span>
          <button type="button" className="icon-btn" aria-label="Yes, helpful" onClick={() => rate(1)} disabled={state === "busy"}><ThumbsUp className="ic" aria-hidden="true" /></button>
          <button type="button" className="icon-btn" aria-label="No, not helpful" onClick={() => rate(-1)} disabled={state === "busy"}><ThumbsDown className="ic" aria-hidden="true" /></button>
        </>
      ) : rating === 1 || state === "noted" ? (
        <span className="thumbs-q" role="status">Thanks, noted.</span>
      ) : (
        <form className="thumbs-note" onSubmit={(e) => { e.preventDefault(); void sendNote(); }}>
          <label htmlFor={noteId} className="thumbs-q">Thanks. What went wrong? (optional)</label>
          <input id={noteId} className="input" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="btn small" disabled={state === "busy" || !note.trim()}>Send</button>
        </form>
      )}
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}
