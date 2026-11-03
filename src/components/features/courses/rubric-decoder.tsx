"use client";

import { Check, FileText, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ChecklistItem } from "@/lib/db/checklist";
import type { RubricCandidate, RubricKind } from "@/lib/rubric/extract";

const KIND_LABEL: Record<RubricKind, string> = { criterion: "Criterion", deadline: "Deadline", deliverable: "Deliverable", requirement: "Requirement" };
type Row = RubricCandidate & { keep: boolean };

/**
 * Rubric Decoder: decode an indexed brief into checklist candidates, let the student edit, drop or keep each
 * one (with the page it came from), then save. Nothing is stored until "Save checklist".
 */
export function RubricDecoder({ assignment, documents }: { assignment: { id: string; title: string }; documents: { id: string; filename: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // Derived, not stored: the brief list can change (a new upload finishes indexing) after this mounts.
  const documentId = documents.some((d) => d.id === picked) ? picked! : (documents[0]?.id ?? "");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [weightTotal, setWeightTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState<"decode" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleId = `rubric-title-${assignment.id}`;

  async function decode() {
    setBusy("decode");
    setError(null);
    try {
      const res = await api<{ candidates: RubricCandidate[]; weightTotal: number | null }>("/api/rubric/extract", { method: "POST", body: { documentId } });
      setRows(res.candidates.map((c) => ({ ...c, keep: true })));
      setWeightTotal(res.weightTotal);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't read the brief.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!rows) return;
    const items = rows.filter((r) => r.keep && r.text.trim().length >= 2).map(({ kind, text, weight, page }) => ({ kind, text: text.trim(), weight, page }));
    setBusy("save");
    setError(null);
    try {
      await api(`/api/assignments/${assignment.id}/checklist`, { method: "PUT", body: { documentId, items } });
      setOpen(false);
      setRows(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't save the checklist.");
    } finally {
      setBusy(null);
    }
  }

  const kept = rows?.filter((r) => r.keep).length ?? 0;
  return (
    <>
      <button type="button" className="icon-btn" aria-label={`Decode brief for ${assignment.title}`} title="Decode brief" onClick={() => { setOpen(true); setError(null); }}>
        <ListChecks className="ic" aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="rubric-dialog">
          <div className="eyebrow">Rubric decoder</div>
          <h2 id={titleId}>Turn the brief into a checklist</h2>
          <p className="muted">Pick the brief for “{assignment.title}”. Criteria, deadlines, deliverables and requirements are found in the text (no AI), each with its page. Edit or drop anything before saving.</p>
          {documents.length === 0 ? (
            <Notice title="Upload the assignment brief to this course first">Then come back here to decode it.</Notice>
          ) : (
            <div className="rubric-pick">
              <div className="field">
                <label htmlFor={`rubric-doc-${assignment.id}`}>Brief</label>
                <select id={`rubric-doc-${assignment.id}`} className="select" value={documentId} onChange={(e) => { setPicked(e.target.value); setRows(null); }}>
                  {documents.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
                </select>
              </div>
              <button type="button" className="btn" onClick={decode} disabled={busy !== null || !documentId}>
                {busy === "decode" ? <span className="spinner" aria-hidden="true" /> : <FileText className="ic" aria-hidden="true" />} Decode brief
              </button>
            </div>
          )}
          {rows ? (
            rows.length === 0 ? (
              <Notice title="No criteria or requirements found in this document">Is it the assignment brief? Briefs with “(30%)”-style weights and must/should sentences decode best.</Notice>
            ) : (
              <>
                {weightTotal !== null && weightTotal !== 100 ? <Notice title={`Criterion weights add up to ${weightTotal}%, not 100%`}>Check the brief: a criterion may be split across lines or missing.</Notice> : null}
                <ul className="rubric-rows" aria-label="Decoded items">
                  {rows.map((r, i) => (
                    <li key={i} className={r.keep ? undefined : "dropped"}>
                      <label className="rubric-keep">
                        <input type="checkbox" checked={r.keep} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} />
                        <span className="visually-hidden">Keep item {i + 1}</span>
                      </label>
                      <div className="rubric-fields">
                        <span className="rubric-meta">
                          <Chip tone={r.kind === "criterion" ? "good" : r.kind === "deadline" ? "warn" : undefined}>{KIND_LABEL[r.kind]}{r.weight ? ` · ${r.weight}%` : ""}</Chip>
                          <span className="muted">p. {r.page}</span>
                        </span>
                        <label className="visually-hidden" htmlFor={`rubric-text-${assignment.id}-${i}`}>Item {i + 1} text</label>
                        <textarea id={`rubric-text-${assignment.id}-${i}`} className="textarea" rows={2} maxLength={400} value={r.text} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}
          {error ? <Notice tone="danger" title={error} /> : null}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            {rows && rows.length ? (
              <button type="button" className="btn primary" onClick={save} disabled={busy !== null}>
                {busy === "save" ? <span className="spinner" aria-hidden="true" /> : <Check className="ic" aria-hidden="true" />} Save checklist ({kept})
              </button>
            ) : null}
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** The saved preparation checklist under an assignment: tick items off as you prepare. */
export function AssignmentChecklist({ title, items }: { title: string; items: ChecklistItem[] }) {
  const router = useRouter();
  const [state, setState] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const done = state.filter((i) => i.done).length;

  async function toggle(item: ChecklistItem) {
    setError(null);
    setState((s) => s.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)));
    try {
      await api(`/api/checklist/${item.id}`, { method: "PATCH", body: { done: !item.done } });
      router.refresh();
    } catch (e) {
      setState((s) => s.map((x) => (x.id === item.id ? { ...x, done: item.done } : x)));
      setError(e instanceof ClientApiError ? e.message : "Couldn't update the item.");
    }
  }

  return (
    <details className="checklist">
      <summary>
        <ListChecks className="ic" aria-hidden="true" /> Preparation checklist · {done}/{state.length} ready
        <span className="checklist-bar" aria-hidden="true"><span style={{ width: `${state.length ? (done / state.length) * 100 : 0}%` }} /></span>
      </summary>
      <ul aria-label={`Checklist for ${title}`}>
        {state.map((item) => (
          <li key={item.id} className={item.done ? "done" : undefined}>
            <label>
              <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
              <span className="ck-kind">{KIND_LABEL[item.kind]}{item.weight ? ` · ${item.weight}%` : ""}</span>
              <span className="ck-text">{item.text}</span>
            </label>
            {item.documentId && item.page ? (
              <a className="cite-chip" href={`/api/documents/${item.documentId}/source?page=${item.page}`} target="_blank" rel="noopener noreferrer">p. {item.page}</a>
            ) : item.page ? <span className="muted">p. {item.page}</span> : null}
          </li>
        ))}
      </ul>
      {error ? <p className="field-error">{error}</p> : null}
    </details>
  );
}
