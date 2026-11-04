"use client";

import { Pause, Play, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

/** Kill switch and daily token budget (ops_flags). Changes apply to new runs within 15 s. */
export function AiControls({ initial }: { initial: { enabled: boolean; budget: number; note: string | null } }) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(initial.budget));
  const [note, setNote] = useState(initial.note ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "danger"; text: string } | null>(null);
  async function save(aiEnabled: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/ops/flags", { method: "POST", body: { aiEnabled, dailyTokenBudget: Number(budget), note: note.trim() || null } });
      setMessage({ tone: "good", text: aiEnabled ? "Saved. AI is on." : "Saved. AI is paused for new runs." });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "danger", text: e instanceof ClientApiError ? e.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ops-controls" onSubmit={(e) => { e.preventDefault(); void save(initial.enabled); }}>
      <div className="field">
        <label htmlFor="ops-budget">Daily token budget (all students)</label>
        <input id="ops-budget" className="input" inputMode="numeric" pattern="[0-9]*" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="field">
        <label htmlFor="ops-note">Operator note (optional, shown only here)</label>
        <input id="ops-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="ops-actions">
        <button type="submit" className="btn small" disabled={busy}><Save className="ic" aria-hidden="true" /> Save</button>
        {initial.enabled ? (
          <button type="button" className="btn small" disabled={busy} onClick={() => save(false)}><Pause className="ic" aria-hidden="true" /> Pause AI</button>
        ) : (
          <button type="button" className="btn small primary" disabled={busy} onClick={() => save(true)}><Play className="ic" aria-hidden="true" /> Resume AI</button>
        )}
      </div>
      {message ? <Notice tone={message.tone === "good" ? "info" : "danger"} title={message.text} /> : null}
    </form>
  );
}

export function ResolveButton({ fingerprint }: { fingerprint: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn small"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/ops/errors/${fingerprint}/resolve`, { method: "POST" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      Resolve
    </button>
  );
}
