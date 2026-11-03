"use client";

import { FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import { uploadAndProcessPdf } from "@/lib/client/upload";
import type { SyllabusCandidate } from "@/lib/syllabus/extract";
import { isoToLocalInput, localInputToIso } from "@/lib/time";

type Row = SyllabusCandidate & { include: boolean; local: string; hours: number };
type Stage = "source" | "working" | "review" | "saving" | "done";

/** Smart Syllabus Import: extract dated graded work, let the student edit/confirm, then create assignments. */
export default function SyllabusImport({ courses, timezone, defaultOpen = false }: { courses: { id: string; title: string }[]; timezone: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [stage, setStage] = useState<Stage>("source");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "new");
  const [newTitle, setNewTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [targetCourse, setTargetCourse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(0);

  function reset() {
    setStage("source");
    setFile(null);
    setRows([]);
    setError(null);
    setCreated(0);
  }

  async function extract(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a syllabus PDF first.");
    setError(null);
    setStage("working");
    try {
      let target = courseId;
      if (target === "new") {
        if (!newTitle.trim()) throw new Error("Enter a name for the new course.");
        setProgress("Creating the course…");
        target = (await api<{ course: { id: string } }>("/api/courses", { method: "POST", body: { title: newTitle.trim() } })).course.id;
      }
      setTargetCourse(target);
      const doc = await uploadAndProcessPdf(target, file, setProgress);
      if (doc.status !== "ready") throw new Error(doc.errorMessage ?? "The syllabus couldn't be processed.");
      setProgress("Finding dated deadlines…");
      const res = await api<{ candidates: SyllabusCandidate[] }>("/api/syllabus/extract", { method: "POST", body: { documentId: doc.id } });
      setRows(res.candidates.map((c) => ({ ...c, include: true, local: isoToLocalInput(c.dueAt, timezone), hours: Math.round((c.estimatedMinutes / 60) * 2) / 2 })));
      setStage("review");
    } catch (e) {
      setError(e instanceof ClientApiError || e instanceof Error ? e.message : "Import failed.");
      setStage("source");
    }
  }

  async function confirm() {
    if (!targetCourse) return;
    setStage("saving");
    setError(null);
    let count = 0;
    try {
      for (const r of rows.filter((x) => x.include)) {
        await api("/api/assignments", {
          method: "POST",
          body: { courseId: targetCourse, title: r.title.trim().slice(0, 200), dueAt: localInputToIso(r.local, timezone), estimatedMinutes: Math.max(5, Math.round(r.hours * 60)), notes: `Imported from syllabus (p. ${r.page}): ${r.sourceText}`.slice(0, 2000) },
        });
        count++;
      }
      setCreated(count);
      setStage("done");
      router.refresh();
    } catch (e) {
      setCreated(count);
      setError(`${count} saved, then: ${e instanceof ClientApiError ? e.message : "an error occurred"}`);
      setStage("review");
    }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const included = rows.filter((r) => r.include).length;

  return (
    <>
      <button type="button" className="btn small" onClick={() => { reset(); setOpen(true); }}>
        <Sparkles className="ic" aria-hidden="true" /> Import syllabus
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="syllabus-title">
        <div className="eyebrow">Smart syllabus import</div>
        <h2 id="syllabus-title" style={{ marginTop: 13 }}>
          {stage === "review" || stage === "saving" ? "Confirm what to add" : stage === "done" ? "Deadlines added" : "Turn a syllabus into deadlines"}
        </h2>
        {stage === "source" || stage === "working" ? (
          <form onSubmit={extract} style={{ display: "grid", gap: 14 }}>
            <p>Upload a text-based syllabus PDF. CatchUp AI finds dated assignments, quizzes and exams and shows them to you first. Nothing is saved until you confirm.</p>
            <div className="field">
              <label htmlFor="syl-course">Course</label>
              <select id="syl-course" className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={stage === "working"}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                <option value="new">+ New course</option>
              </select>
            </div>
            {courseId === "new" ? (
              <div className="field">
                <label htmlFor="syl-new">New course name</label>
                <input id="syl-new" className="input" maxLength={120} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} disabled={stage === "working"} />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="syl-file">Syllabus PDF</label>
              <input id="syl-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={stage === "working"} />
            </div>
            {stage === "working" ? <p role="status"><span className="spinner" aria-hidden="true" /> {progress}</p> : null}
            {error ? <Notice tone="danger" title={error} /> : null}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={stage === "working"}><FileText className="ic" aria-hidden="true" /> Find deadlines</button>
            </div>
          </form>
        ) : null}
        {stage === "review" || stage === "saving" ? (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.length === 0 ? (
              <Notice tone="info" title="No dated graded work found in this syllabus.">The file was saved to the course. You can add assignments manually.</Notice>
            ) : (
              <>
                <p>Times are in {timezone}. Estimates are starting points; adjust them before saving.</p>
                <ul className="syllabus-rows" aria-label="Detected deadlines">
                  {rows.map((r, i) => (
                    <li key={`${r.title}-${r.dueAt}`} className="syllabus-row">
                      <label className="syllabus-include">
                        <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                        <span className="visually-hidden">Include {r.title}</span>
                      </label>
                      <div className="syllabus-fields">
                        <input className="input" aria-label={`Title (row ${i + 1})`} value={r.title} maxLength={200} onChange={(e) => update(i, { title: e.target.value })} />
                        <div className="syllabus-inline">
                          <input className="input" type="datetime-local" aria-label={`Due (row ${i + 1})`} value={r.local} onChange={(e) => update(i, { local: e.target.value })} />
                          <input className="input" type="number" min={0.5} max={160} step={0.5} aria-label={`Estimated hours (row ${i + 1})`} value={r.hours} onChange={(e) => update(i, { hours: Number(e.target.value) || 0.5 })} />
                          <span className="muted" style={{ fontSize: 11 }}>h</span>
                        </div>
                        <span className="syllabus-source">p. {r.page}: “{r.sourceText}”</span>
                        {r.assumptions.length ? <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{r.assumptions.map((a) => <Chip key={a} tone="warn">{a}</Chip>)}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {error ? <Notice tone="danger" title={error} /> : null}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{rows.length ? "Discard" : "Close"}</button>
              {rows.length ? (
                <button type="button" className="btn primary" onClick={confirm} disabled={stage === "saving" || included === 0}>
                  {stage === "saving" ? <span className="spinner" aria-hidden="true" /> : null} Add {included} deadline{included === 1 ? "" : "s"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {stage === "done" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Notice tone="info" title={`${created} deadline${created === 1 ? "" : "s"} added to the course.`}>They now count in the recovery lab and your briefing.</Notice>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
              <button type="button" className="btn primary" onClick={() => { setOpen(false); router.push(`/courses/${targetCourse}`); }}>Open course</button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
