"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/controls";
import { api, ClientApiError } from "@/lib/client/api";

type Prefs = { dailyDigest: boolean; missedAlert: boolean };

/** Opt-in study emails. Both are off until the student turns them on; every email has a one-click unsubscribe. */
export default function NudgesCard({ initial, isAnonymous, mailReady }: { initial: Prefs; isAnonymous: boolean; mailReady: boolean }) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(next: Prefs) {
    const previous = prefs;
    setPrefs(next);
    setBusy(true);
    setError(null);
    try {
      await api("/api/nudges/prefs", { method: "PUT", body: next });
    } catch (e) {
      setPrefs(previous);
      setError(e instanceof ClientApiError ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || isAnonymous;
  return (
    <div className="card setting-card">
      <div className="split-head"><h3>Study emails</h3></div>
      <div className="setting-line">
        <div><strong>Morning digest</strong><p>Your next 24 hours of study blocks and deadlines due within three days. Skipped on days with nothing planned.</p></div>
        <Switch checked={prefs.dailyDigest} onChange={(v) => change({ ...prefs, dailyDigest: v })} label="Morning digest email" disabled={disabled} />
      </div>
      <div className="setting-line">
        <div><strong>Missed-block alert</strong><p>If a block passes unfinished, one gentle email with a link to replan from now.</p></div>
        <Switch checked={prefs.missedAlert} onChange={(v) => change({ ...prefs, missedAlert: v })} label="Missed-block alert email" disabled={disabled} />
      </div>
      <p className="muted setting-foot">
        {isAnonymous ? "Demo accounts have no email address. Create an account to get study emails." : "At most one email a day. Every email has a one-click unsubscribe link."}
        {!mailReady && !isAnonymous ? " Sending isn't configured on this server yet, so nothing will be sent." : ""}
      </p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
