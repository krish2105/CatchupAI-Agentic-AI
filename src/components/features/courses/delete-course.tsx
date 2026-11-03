"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

export default function DeleteCourse({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/courses/${id}`, { method: "DELETE" });
      router.push("/courses");
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't delete the course.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}><Trash2 className="ic" aria-hidden="true" /> Delete</button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="delete-course-title">
        <div className="eyebrow">Permanent action</div>
        <h2 id="delete-course-title" style={{ marginTop: 13 }}>Delete “{title}”?</h2>
        <p>This permanently removes the course with its assignments, documents and any plan tasks linked to it. This cannot be undone.</p>
        {error ? <Notice tone="danger" title={error} /> : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Keep course</button>
          <button type="button" className="btn primary" onClick={confirm} disabled={busy}>{busy ? <span className="spinner" aria-hidden="true" /> : null} Delete course</button>
        </div>
      </Dialog>
    </>
  );
}
