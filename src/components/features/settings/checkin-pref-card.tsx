"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/controls";
import { api, ClientApiError } from "@/lib/client/api";

/** The daily check-in: on by default, one switch to turn it off. It only ever drafts; the student decides. */
export default function CheckinPrefCard({ initial, isAnonymous }: { initial: boolean; isAnonymous: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setBusy(true);
    setError(null);
    try {
      await api("/api/checkins/prefs", { method: "PUT", body: { enabled: next } });
    } catch (e) {
      setEnabled(previous);
      setError(e instanceof ClientApiError ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card setting-card">
      <div className="split-head"><h3>Daily check-in</h3></div>
      <div className="setting-line">
        <div>
          <strong>Let CatchUp check in</strong>
          <p>Each morning CatchUp looks at your approved plan. If you missed blocks or a deadline no longer fits, it drafts a fix and says why on Mission control. Nothing changes until you approve; you can dismiss it.</p>
        </div>
        <Switch checked={enabled} onChange={(v) => void change(v)} label="Let CatchUp check in" disabled={busy || isAnonymous} />
      </div>
      <p className="muted setting-foot">{isAnonymous ? "Demo accounts aren't checked in on. Create an account to use it." : "At most one check-in a day. It reads only your own plan, deadlines and completed blocks."}</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
