"use client";

import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import type { MemoryDto } from "@/lib/memory/service";

/**
 * "What the copilot remembers": the student's own notes for the copilot. Suggestions from the copilot stay
 * pending until the student keeps them; everything can be edited or deleted.
 */
export default function MemoryPanel({ initial }: { initial: MemoryDto[] }) {
  const [memories, setMemories] = useState(initial);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => void api<{ memories: MemoryDto[] }>("/api/memories").then((r) => setMemories(r.memories)).catch(() => {});
    window.addEventListener("catchup:memories", reload);
    return () => window.removeEventListener("catchup:memories", reload);
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const replace = (m: MemoryDto) => setMemories((list) => list.map((x) => (x.id === m.id ? m : x)));
  const add = () => act(async () => {
    const { memory } = await api<{ memory: MemoryDto }>("/api/memories", { method: "POST", body: { text: draft } });
    setMemories((list) => [...list, memory]);
    setDraft("");
  });
  const save = () => act(async () => {
    if (!editing) return;
    replace((await api<{ memory: MemoryDto }>(`/api/memories/${editing.id}`, { method: "PATCH", body: { text: editing.text } })).memory);
    setEditing(null);
  });
  const keep = (id: string) => act(async () => replace((await api<{ memory: MemoryDto }>(`/api/memories/${id}`, { method: "PATCH", body: { confirm: true } })).memory));
  const remove = (id: string) => act(async () => {
    await api(`/api/memories/${id}`, { method: "DELETE" });
    setMemories((list) => list.filter((x) => x.id !== id));
  });

  const suggested = memories.filter((m) => m.status === "suggested");
  const confirmed = memories.filter((m) => m.status === "confirmed");
  return (
    <section className="card card-inner memory-panel section-space" aria-labelledby="memory-title">
      <div className="split-head">
        <h3 id="memory-title"><Brain className="ic" aria-hidden="true" /> What the copilot remembers</h3>
        <span className="muted">{confirmed.length}/40</span>
      </div>
      <p className="muted memory-help">Only what you keep here is used, and only to personalise advice. Nothing is learned silently.</p>

      {suggested.length ? (
        <div className="memory-suggested" aria-label="Suggested by the copilot">
          <div className="label">Suggested by the copilot · not used until you keep it</div>
          <ul>
            {suggested.map((m) => (
              <li key={m.id}>
                <span>{m.text}</span>
                <span className="memory-actions">
                  <button type="button" className="btn small" onClick={() => keep(m.id)} disabled={busy}><Check className="ic" aria-hidden="true" /> Keep</button>
                  <button type="button" className="btn small ghost" onClick={() => remove(m.id)} disabled={busy} aria-label={`Dismiss suggestion: ${m.text}`}><X className="ic" aria-hidden="true" /> Dismiss</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirmed.length ? (
        <ul className="memory-list" aria-label="Remembered">
          {confirmed.map((m) => (
            <li key={m.id}>
              {editing?.id === m.id ? (
                <form className="memory-edit" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                  <label className="visually-hidden" htmlFor={`mem-${m.id}`}>Edit memory</label>
                  <input id={`mem-${m.id}`} className="input" value={editing.text} maxLength={280} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} />
                  <button type="submit" className="btn small" disabled={busy || editing.text.trim().length < 3}>Save</button>
                  <button type="button" className="btn small ghost" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span>{m.text}{m.source === "copilot" ? <span className="muted"> · suggested by the copilot</span> : null}</span>
                  <span className="memory-actions">
                    <button type="button" className="icon-btn" aria-label={`Edit: ${m.text}`} onClick={() => setEditing({ id: m.id, text: m.text })} disabled={busy}><Pencil className="ic" aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={`Delete: ${m.text}`} onClick={() => remove(m.id)} disabled={busy}><Trash2 className="ic" aria-hidden="true" /></button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="muted">Nothing yet. Add a habit or goal, like &ldquo;I study best before 10am&rdquo;.</p>}

      <form className="memory-add" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label className="visually-hidden" htmlFor="memory-new">Something for the copilot to remember</label>
        <input id="memory-new" className="input" placeholder="e.g. Exams make me anxious; keep plans gentle" value={draft} maxLength={280} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn small" disabled={busy || draft.trim().length < 3}><Plus className="ic" aria-hidden="true" /> Remember</button>
      </form>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
