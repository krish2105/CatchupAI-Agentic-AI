"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

/** Free-text feedback: what worked, what didn't, what's missing. Stored privately with the student's account. */
export default function FeedbackCard() {
  const page = usePathname();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState("busy");
    setError(null);
    try {
      await api("/api/feedback", { method: "POST", body: { kind: "general", comment: text.trim(), page } });
      setText("");
      setState("sent");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't send your feedback.");
      setState("idle");
    }
  }

  return (
    <form className="card setting-card" onSubmit={submit}>
      <div className="split-head"><h3>Send feedback</h3></div>
      <div className="field">
        <label htmlFor="feedback-text">What helped, what got in the way, or what&apos;s missing?</label>
        <textarea id="feedback-text" className="input" rows={4} maxLength={1000} value={text} onChange={(e) => { setText(e.target.value); if (state === "sent") setState("idle"); }} />
      </div>
      {state === "sent" ? <div style={{ marginTop: 12 }}><Notice tone="info" title="Thanks, your feedback was saved." /></div> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="btn small primary" disabled={state === "busy" || !text.trim()}>Send feedback</button>
      </div>
    </form>
  );
}
