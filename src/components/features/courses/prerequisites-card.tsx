"use client";

import { Plus, Route, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

/** "Builds on": the student links this course to foundations it depends on (shown in the universe). */
export default function PrerequisitesCard({ courseId, courses, requires }: { courseId: string; courses: { id: string; title: string }[]; requires: string[] }) {
  const router = useRouter();
  const options = courses.filter((c) => c.id !== courseId && !requires.includes(c.id));
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = (id: string) => courses.find((c) => c.id === id)?.title ?? "Course";
  const selected = options.some((o) => o.id === pick) ? pick : (options[0]?.id ?? "");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't update the learning trail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-inner prereq-card" aria-labelledby="prereq-head">
      <div className="split-head"><h3 id="prereq-head"><Route className="ic" aria-hidden="true" /> Builds on</h3></div>
      <p className="muted">Link courses this one depends on. The learning universe draws the trail and suggests a study order. Only links you add are shown.</p>
      {requires.length ? (
        <ul className="prereq-list" aria-label="Courses this builds on">
          {requires.map((id) => (
            <li key={id}>
              <span>{title(id)}</span>
              <button type="button" className="icon-btn" aria-label={`Remove link to ${title(id)}`} disabled={busy} onClick={() => run(() => api(`/api/courses/${courseId}/prerequisites?requires=${id}`, { method: "DELETE" }))}><X className="ic" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      {options.length ? (
        <div className="prereq-add">
          <label className="visually-hidden" htmlFor={`prereq-${courseId}`}>Course this builds on</label>
          <select id={`prereq-${courseId}`} className="select" value={selected} onChange={(e) => setPick(e.target.value)}>
            {options.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button type="button" className="btn small" disabled={busy || !selected} onClick={() => run(() => api(`/api/courses/${courseId}/prerequisites`, { method: "POST", body: { requiresCourseId: selected } }))}><Plus className="ic" aria-hidden="true" /> Add link</button>
        </div>
      ) : requires.length ? null : <p className="muted">Add another course to link them.</p>}
      {error ? <Notice tone="danger" title={error} /> : null}
    </section>
  );
}
