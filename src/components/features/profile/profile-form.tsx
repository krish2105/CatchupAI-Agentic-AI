"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { Profile } from "@/lib/db/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function timeZones(current: string) {
  const list = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return list.includes(current) ? list : [current, ...list];
}

export default function ProfileForm({ profile, onboarding = false }: { profile: Profile; onboarding?: boolean }) {
  const router = useRouter();
  const initialZone = onboarding && profile.timezone === "UTC" ? Intl.DateTimeFormat().resolvedOptions().timeZone : profile.timezone;
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [timezone, setTimezone] = useState(initialZone);
  const [weekly, setWeekly] = useState(profile.weeklyMinutes);
  const [start, setStart] = useState(profile.studyStartTime);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => timeZones(initialZone), [initialZone]);
  const total = weekly.reduce((sum, m) => sum + m, 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: { displayName: displayName.trim() || null, timezone, weeklyMinutes: weekly, studyStartTime: start, ...(onboarding ? { completeOnboarding: true } : {}) },
      });
      setStatus("saved");
      if (onboarding) router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setStatus("idle");
      setError(e instanceof ClientApiError ? e.message : "Couldn't save your profile.");
    }
  }

  return (
    <form onSubmit={submit} className="form-grid" aria-describedby={error ? "profile-error" : undefined}>
      <div className="field">
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" className="input" maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" />
      </div>
      <div className="field">
        <label htmlFor="timezone">Time zone</label>
        <select id="timezone" className="select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <span className="field-hint">Deadlines and study blocks are shown and scheduled in this zone.</span>
      </div>
      <fieldset className="span-2" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label" style={{ fontSize: 11, fontWeight: 750, color: "var(--muted)", marginBottom: 8 }}>
          Study minutes available per day · {Math.floor(total / 60)}h {total % 60}m per week
        </legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))", gap: 8 }}>
          {DAYS.map((day, i) => (
            <div className="field" key={day}>
              <label htmlFor={`day-${i}`}>{day}</label>
              <input
                id={`day-${i}`}
                className="input"
                type="number"
                min={0}
                max={720}
                step={15}
                value={weekly[i]}
                onChange={(e) => setWeekly((w) => w.map((m, j) => (j === i ? Math.max(0, Math.min(720, Number(e.target.value) || 0)) : m)))}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="start">Daily study blocks start at</label>
        <input id="start" className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
      </div>
      <div className="span-2" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? <span className="spinner" aria-hidden="true" /> : null}
          {onboarding ? "Save and continue" : "Save profile"}
        </button>
        <span role="status" className="muted" style={{ fontSize: 12 }}>{status === "saved" ? "Saved." : ""}</span>
      </div>
      {error ? <div id="profile-error" className="span-2"><Notice tone="danger" title={error} /></div> : null}
    </form>
  );
}
