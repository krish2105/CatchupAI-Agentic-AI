"use client";

import { CalendarDays, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import { parseLmsFile, type ImportCandidate, type ImportResult } from "@/lib/import/lms";
import { isoToLocalInput, localInputToIso } from "@/lib/time";

type Row = ImportCandidate & { include: boolean; local: string; hours: number; note: string | null };
type Stage = "source" | "review" | "saving" | "done";
type Saved = { created: number; createdCourses: string[]; skippedDuplicates: number };

const FORMAT = { ics: "calendar export", csv: "CSV file", imscc: "course export" } as const;
const sameItem = (a: { courseTitle: string; title: string; dueAt: string }, b: { courseTitle: string; title: string; dueAt: string }) =>
  a.courseTitle.trim().toLowerCase() === b.courseTitle.trim().toLowerCase() && a.title.trim().toLowerCase() === b.title.trim().toLowerCase() && Date.parse(a.dueAt) === Date.parse(b.dueAt);

/**
 * Import deadlines from a learning platform's export (Canvas, Moodle, Google Classroom: .ics, .csv or .imscc).
 * The file is read in the browser and nothing is sent until the student reviews the rows and confirms; past
 * deadlines and items already in CatchUp start unticked.
 */
export default function LmsImport({ timezone, existing, now }: { timezone: string; existing: { courseTitle: string; title: string; dueAt: string }[]; now: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("source");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  function reset() {
    setStage("source");
    setResult(null);
    setRows([]);
    setError(null);
    setSaved(null);
  }

  async function read(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseLmsFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, { timezone });
      setFileName(file.name);
      setResult(parsed);
      setRows(parsed.candidates.map((c) => {
        const past = Date.parse(c.dueAt) <= now;
        const dup = existing.some((e) => sameItem(e, c));
        return { ...c, include: !past && !dup, local: isoToLocalInput(c.dueAt, timezone), hours: Math.round((c.estimatedMinutes / 60) * 2) / 2, note: dup ? "Already in CatchUp" : past ? "Already past" : null };
      }));
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This file couldn't be read.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setStage("saving");
    setError(null);
    const items = rows.filter((r) => r.include).map((r) => ({
      courseTitle: r.courseTitle.trim().slice(0, 120) || "Imported course",
      title: r.title.trim().slice(0, 200),
      dueAt: localInputToIso(r.local, timezone),
      estimatedMinutes: Math.max(5, Math.min(10080, Math.round(r.hours * 60))),
      notes: `Imported from ${fileName} (${r.source})`.slice(0, 2000),
    }));
    const total: Saved = { created: 0, createdCourses: [], skippedDuplicates: 0 };
    try {
      for (let i = 0; i < items.length; i += 200) {
        const r = await api<Saved>("/api/import/assignments", { method: "POST", body: { items: items.slice(i, i + 200) } });
        total.created += r.created;
        total.createdCourses.push(...r.createdCourses);
        total.skippedDuplicates += r.skippedDuplicates;
      }
      setSaved(total);
      setStage("done");
      router.refresh();
    } catch (e) {
      setError(`${total.created} saved, then: ${e instanceof ClientApiError ? e.message : "an error occurred"}`);
      setStage("review");
    }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const included = rows.filter((r) => r.include).length;

  return (
    <>
      <button type="button" className="btn small" onClick={() => { reset(); setOpen(true); }}>
        <CalendarDays className="ic" aria-hidden="true" /> Import from LMS
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="lms-title">
        <div className="eyebrow">Canvas · Moodle · Google Classroom</div>
        <h2 id="lms-title" style={{ marginTop: 13 }}>{stage === "done" ? "Deadlines imported" : stage === "source" ? "Import deadlines from your LMS" : "Confirm what to add"}</h2>
        {stage === "source" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <p>Choose a file you exported from your learning platform. It is read on this device, and nothing is saved until you confirm.</p>
            <ul className="muted lms-help">
              <li><strong>Calendar (.ics):</strong> Canvas Calendar → Calendar feed, Moodle Calendar → Export calendar, or a Google Classroom class calendar.</li>
              <li><strong>Spreadsheet (.csv):</strong> columns for the title and due date; course and hours are optional.</li>
              <li><strong>Course export (.imscc):</strong> a Canvas or Common Cartridge course package.</li>
            </ul>
            <div className="field">
              <label htmlFor="lms-file">Export file</label>
              <input id="lms-file" type="file" accept=".ics,.csv,.tsv,.imscc,.zip,text/calendar,text/csv" onChange={(e) => void read(e.target.files?.[0] ?? null)} disabled={busy} />
            </div>
            {busy ? <p role="status"><span className="spinner" aria-hidden="true" /> Reading the file…</p> : null}
            {error ? <Notice tone="danger" title={error} /> : null}
            <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button></div>
          </div>
        ) : null}
        {stage === "review" || stage === "saving" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p>
              {rows.length} item{rows.length === 1 ? "" : "s"} found in {fileName} ({result ? FORMAT[result.format] : "file"}). Times are in {timezone}.
              {result?.skipped.length ? ` Skipped: ${result.skipped.map((s) => `${s.count} ${s.reason}`).join("; ")}.` : ""}
            </p>
            {rows.length === 0 ? <Notice tone="info" title="No dated deadlines found in this file." /> : (
              <ul className="syllabus-rows" aria-label="Imported deadlines">
                {rows.map((r, i) => (
                  <li key={`${r.source}-${i}`} className="syllabus-row">
                    <label className="syllabus-include">
                      <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                      <span className="visually-hidden">Include {r.title}</span>
                    </label>
                    <div className="syllabus-fields">
                      <input className="input" aria-label={`Title (row ${i + 1})`} value={r.title} maxLength={200} onChange={(e) => update(i, { title: e.target.value })} />
                      <input className="input" aria-label={`Course (row ${i + 1})`} value={r.courseTitle} maxLength={120} onChange={(e) => update(i, { courseTitle: e.target.value })} />
                      <div className="syllabus-inline">
                        <input className="input" type="datetime-local" aria-label={`Due (row ${i + 1})`} value={r.local} onChange={(e) => update(i, { local: e.target.value })} />
                        <input className="input" type="number" min={0.5} max={160} step={0.5} aria-label={`Estimated hours (row ${i + 1})`} value={r.hours} onChange={(e) => update(i, { hours: Number(e.target.value) || 0.5 })} />
                        <span className="muted" style={{ fontSize: 11 }}>h</span>
                      </div>
                      {r.note || r.assumptions.length ? (
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {r.note ? <Chip>{r.note}</Chip> : null}
                          {r.assumptions.map((a) => <Chip key={a} tone="warn">{a}</Chip>)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {error ? <Notice tone="danger" title={error} /> : null}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={reset}>Choose another file</button>
              {rows.length ? (
                <button type="button" className="btn primary" onClick={confirm} disabled={stage === "saving" || included === 0}>
                  {stage === "saving" ? <span className="spinner" aria-hidden="true" /> : <Upload className="ic" aria-hidden="true" />} Add {included} deadline{included === 1 ? "" : "s"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {stage === "done" && saved ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Notice tone="info" title={`${saved.created} deadline${saved.created === 1 ? "" : "s"} added.`}>
              {saved.createdCourses.length ? `New course${saved.createdCourses.length === 1 ? "" : "s"}: ${saved.createdCourses.join(", ")}. ` : ""}
              {saved.skippedDuplicates ? `${saved.skippedDuplicates} already existed and ${saved.skippedDuplicates === 1 ? "was" : "were"} skipped. ` : ""}
              They now count in the recovery lab and your calendar.
            </Notice>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
              <button type="button" className="btn primary" onClick={() => { setOpen(false); router.push("/recovery"); }}>Plan around them</button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
