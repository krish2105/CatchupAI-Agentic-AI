"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

export default function PrivacyCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/delete", { method: "POST", body: { confirm: typed } });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Your account couldn't be deleted.");
      setBusy(false);
    }
  }

  return (
    <div className="card setting-card">
      <div className="split-head"><h3>Privacy and data</h3><a className="btn small ghost" href="/privacy">Privacy notice</a></div>
      <div className="setting-line">
        <div><strong>Export your data</strong><p>Download everything stored about you (courses, deadlines, plans, agent runs, quiz attempts, focus sessions) as JSON.</p></div>
        <a className="btn small" href="/api/account/export" download><Download className="ic" aria-hidden="true" /> Export</a>
      </div>
      <div className="setting-line">
        <div><strong>Delete your account</strong><p>Permanently removes your account, files and all records. This can&apos;t be undone.</p></div>
        <button type="button" className="btn small" onClick={() => { setTyped(""); setError(null); setOpen(true); }}><Trash2 className="ic" aria-hidden="true" /> Delete account</button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="delete-account-title">
        <div className="eyebrow">Permanent action</div>
        <h2 id="delete-account-title" style={{ marginTop: 13 }}>Delete your account?</h2>
        <p>Your courses, documents, plans, quiz attempts and focus history will be removed immediately. Export your data first if you want a copy.</p>
        <div className="field">
          <label htmlFor="delete-confirm">Type DELETE to confirm</label>
          <input id="delete-confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {error ? <div style={{ marginTop: 12 }}><Notice tone="danger" title={error} /></div> : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Keep my account</button>
          <button type="button" className="btn primary" onClick={remove} disabled={busy || typed !== "DELETE"}>{busy ? <span className="spinner" aria-hidden="true" /> : null} Delete permanently</button>
        </div>
      </Dialog>
    </div>
  );
}
