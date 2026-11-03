"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { Course } from "@/lib/db/types";

/** Create (no `course`) or edit (with `course`) a course. */
export default function CourseDialog({ course, triggerLabel, small }: { course?: Course; triggerLabel?: string; small?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = course ? `course-edit-${course.id}` : "course-create";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (course) {
        await api(`/api/courses/${course.id}`, { method: "PATCH", body: { title, description } });
        setOpen(false);
        router.refresh();
      } else {
        const res = await api<{ course: Course }>("/api/courses", { method: "POST", body: { title, description } });
        setOpen(false);
        router.push(`/courses/${res.course.id}`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't save the course.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={`btn ${course ? "" : "primary"} ${small ? "small" : ""}`} onClick={() => setOpen(true)}>
        {course ? null : <Plus className="ic" aria-hidden="true" />} {triggerLabel ?? (course ? "Edit course" : "New course")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={`${id}-title`}>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div className="eyebrow">Knowledge vault</div>
          <h2 id={`${id}-title`}>{course ? "Edit course" : "Create a course"}</h2>
          <div className="field">
            <label htmlFor={`${id}-name`}>Course title</label>
            <input id={`${id}-name`} className="input" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor={`${id}-desc`}>Description (optional)</label>
            <textarea id={`${id}-desc`} className="textarea" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error ? <Notice tone="danger" title={error} /> : null}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || !title.trim()}>{busy ? <span className="spinner" aria-hidden="true" /> : null} Save</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
