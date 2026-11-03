"use client";

import { CalendarPlus, Copy, Download, Link2, Link2Off } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

/** Export the approved plan: one-off .ics download, or a private link calendar apps keep in sync. */
export default function CalendarCard({ hasFeed, feedCreatedAt }: { hasFeed: boolean; feedCreatedAt: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [active, setActive] = useState(hasFeed);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ url: string }>("/api/calendar/feed", { method: "POST" });
      setUrl(res.url);
      setActive(true);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't create the link.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/calendar/feed", { method: "DELETE" });
      setUrl(null);
      setActive(false);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't revoke the link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card calendar-card" aria-labelledby="calendar-head">
      <span className="calendar-icon" aria-hidden="true"><CalendarPlus className="ic" /></span>
      <div className="calendar-body">
        <h2 id="calendar-head">Add to your calendar</h2>
        <p>Your approved study blocks and deadlines in Google, Apple or Outlook Calendar. Download a copy, or subscribe with a private link that stays in sync.</p>
        <div className="calendar-actions">
          <a className="btn small" href="/api/calendar/ics" download><Download className="ic" aria-hidden="true" /> Download .ics</a>
          <button type="button" className="btn small primary" onClick={create} disabled={busy}>
            <Link2 className="ic" aria-hidden="true" /> {active ? "Create a new private link" : "Create private link"}
          </button>
          {active ? (
            <button type="button" className="btn small ghost" onClick={revoke} disabled={busy}><Link2Off className="ic" aria-hidden="true" /> Revoke link</button>
          ) : null}
        </div>
        {url ? (
          <div className="calendar-link" role="status">
            <label htmlFor="calendar-url">Your private link (shown once; anyone with it can see your schedule)</label>
            <div>
              <input id="calendar-url" className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn small" onClick={copy}><Copy className="ic" aria-hidden="true" /> {copied ? "Copied" : "Copy"}</button>
            </div>
            <span className="muted">In Google Calendar: Other calendars → From URL. In Apple Calendar: File → New Calendar Subscription.</span>
          </div>
        ) : active ? (
          <p className="muted calendar-note">A private link is active{feedCreatedAt ? ` (created ${new Date(feedCreatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` : ""}. Creating a new one replaces it.</p>
        ) : null}
        {error ? <Notice tone="danger" title={error} /> : null}
      </div>
    </section>
  );
}
