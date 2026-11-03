"use client";

import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ChecklistItem } from "@/lib/db/checklist";
import type { Assignment } from "@/lib/db/types";
import { AssignmentChecklist, RubricDecoder } from "./rubric-decoder";
import { dueLabel, formatDateTime, formatMinutes, isoToLocalInput, localInputToIso } from "@/lib/time";

type Draft = { title: string; notes: string; due: string; hours: number; minutes: number; required: boolean };

function emptyDraft(tz: string): Draft {
  const due = new Date(Date.now() + 3 * 86400_000);
  due.setMinutes(0, 0, 0);
  return { title: "", notes: "", due: isoToLocalInput(due.toISOString(), tz), hours: 2, minutes: 0, required: true };
}

export default function AssignmentsPanel({
  courseId,
  assignments,
  timezone,
  now,
  checklists = {},
  briefs = [],
}: {
  courseId: string;
  assignments: Assignment[];
  timezone: string;
  now: number;
  checklists?: Record<string, ChecklistItem[]>;
  /** Indexed documents of this course that can be decoded as briefs. */
  briefs?: { id: string; filename: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Assignment | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(timezone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setDraft(emptyDraft(timezone));
    setError(null);
    setEditing("new");
  }

  function openEdit(a: Assignment) {
    setDraft({ title: a.title, notes: a.notes, due: isoToLocalInput(a.dueAt, timezone), hours: Math.floor(a.estimatedMinutes / 60), minutes: a.estimatedMinutes % 60, required: a.required });
    setError(null);
    setEditing(a);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title: draft.title,
      notes: draft.notes,
      dueAt: localInputToIso(draft.due, timezone),
      estimatedMinutes: draft.hours * 60 + draft.minutes,
      required: draft.required,
    };
    try {
      if (editing === "new") await api("/api/assignments", { method: "POST", body: { courseId, ...body } });
      else if (editing) await api(`/api/assignments/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't save the assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(a: Assignment, status: Assignment["status"]) {
    try {
      await api(`/api/assignments/${a.id}`, { method: "PATCH", body: { status } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't update the assignment.");
    }
  }

  async function remove(a: Assignment) {
    if (!window.confirm(`Delete “${a.title}”? This cannot be undone.`)) return;
    try {
      await api(`/api/assignments/${a.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't delete the assignment.");
    }
  }

  return (
    <div className="card card-inner">
      <div className="split-head">
        <h3>Assignments</h3>
        <button type="button" className="btn small primary" onClick={openNew}><Plus className="ic" aria-hidden="true" /> Add assignment</button>
      </div>
      {error && !editing ? <Notice tone="danger" title={error} /> : null}
      {assignments.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>No assignments yet. Add deadlines and effort estimates so the recovery lab can check what fits.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Assignments">
          {assignments.map((a) => {
            const overdue = a.status !== "completed" && new Date(a.dueAt).getTime() < now;
            return (
              <li key={a.id} className="task-item" style={{ flexWrap: "wrap" }}>
                <span style={{ minWidth: 0, flex: "1 1 260px" }}>
                  <CalendarClock className="ic" aria-hidden="true" />
                  <span style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: 12.5, textDecoration: a.status === "completed" ? "line-through" : undefined }}>{a.title}</strong>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {formatDateTime(a.dueAt, timezone)} · {formatMinutes(a.estimatedMinutes)} · {a.required ? "required" : "optional"}
                    </span>
                  </span>
                </span>
                <span style={{ gap: 8 }}>
                  {a.status === "completed" ? <Chip tone="good">Done</Chip> : overdue ? <Chip tone="danger">{dueLabel(a.dueAt, now)}</Chip> : <Chip>{dueLabel(a.dueAt, now)}</Chip>}
                  <label className="visually-hidden" htmlFor={`status-${a.id}`}>Status for {a.title}</label>
                  <select id={`status-${a.id}`} className="select" style={{ width: "auto", padding: "7px 9px", fontSize: 11 }} value={a.status} onChange={(e) => setStatus(a, e.target.value as Assignment["status"])}>
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <RubricDecoder assignment={{ id: a.id, title: a.title }} documents={briefs} />
                  <button type="button" className="icon-btn" aria-label={`Edit ${a.title}`} onClick={() => openEdit(a)}><Pencil className="ic" aria-hidden="true" /></button>
                  <button type="button" className="icon-btn" aria-label={`Delete ${a.title}`} onClick={() => remove(a)}><Trash2 className="ic" aria-hidden="true" /></button>
                </span>
                {checklists[a.id]?.length ? <AssignmentChecklist key={checklists[a.id].map((i) => i.id).join()} title={a.title} items={checklists[a.id]} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} labelledBy="assignment-dialog-title">
        <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
          <div className="eyebrow">Assignment</div>
          <h2 id="assignment-dialog-title">{editing === "new" ? "Add an assignment" : "Edit assignment"}</h2>
          <div className="field">
            <label htmlFor="a-title">Title</label>
            <input id="a-title" className="input" required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="a-due">Due ({timezone})</label>
            <input id="a-due" className="input" type="datetime-local" required value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="a-hours">Estimated hours</label>
              <input id="a-hours" className="input" type="number" min={0} max={168} value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div className="field">
              <label htmlFor="a-minutes">+ minutes</label>
              <input id="a-minutes" className="input" type="number" min={0} max={55} step={5} value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Math.max(0, Math.min(55, Number(e.target.value) || 0)) })} />
            </div>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} />
            Required (always included in every recovery route)
          </label>
          <div className="field">
            <label htmlFor="a-notes">Notes (optional)</label>
            <textarea id="a-notes" className="textarea" rows={2} maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
          {error ? <Notice tone="danger" title={error} /> : null}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || !draft.title.trim() || draft.hours * 60 + draft.minutes < 5}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null} Save assignment
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
