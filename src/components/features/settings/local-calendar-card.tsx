"use client";

import { useState, type FormEvent } from "react";
import { Switch } from "@/components/ui/controls";
import { api, ClientApiError } from "@/lib/client/api";
import { PRAYER_METHODS, RAMADAN_REDUCTION, UAE_CITIES, type LocalCalendarPrefs, type PrayerMethod, type UaeCity } from "@/lib/planner/calendar-options";

const REDUCTIONS = Array.from({ length: (RAMADAN_REDUCTION.max - RAMADAN_REDUCTION.min) / RAMADAN_REDUCTION.step + 1 }, (_, i) => RAMADAN_REDUCTION.min + i * RAMADAN_REDUCTION.step);

/**
 * Local calendar (UAE study defaults). Weeks already start on Monday everywhere in the app. Every religious setting
 * is off until the student turns it on, and prayer times come from the city they pick, never from the device.
 * Switches and selects save at once; the Ramadan details save with their own button.
 */
export default function LocalCalendarCard({ initial }: { initial: LocalCalendarPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [ramadan, setRamadan] = useState({
    reduction: initial.ramadanReductionPercent,
    studyStart: initial.ramadanStudyStart ?? "",
    start: initial.ramadanStart ?? "",
    end: initial.ramadanEnd ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(next: LocalCalendarPrefs) {
    const previous = prefs;
    setPrefs(next);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ prefs: LocalCalendarPrefs }>("/api/calendar-prefs", { method: "PUT", body: next });
      setPrefs(res.prefs);
      return true;
    } catch (e) {
      setPrefs(previous);
      setError(e instanceof ClientApiError ? e.message : "Couldn't save that.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function chooseCity(value: string) {
    const city = (value || null) as UaeCity | null;
    // Without a city there are no prayer times, so the settings that need them switch off too.
    void save(city ? { ...prefs, city, method: prefs.method ?? "dubai" } : { ...prefs, city: null, method: null, prayerBreaks: false, ramadanMode: false });
  }

  async function saveRamadan(event: FormEvent) {
    event.preventDefault();
    const ok = await save({
      ...prefs,
      ramadanReductionPercent: ramadan.reduction,
      ramadanStudyStart: ramadan.studyStart || null,
      ramadanStart: ramadan.start || null,
      ramadanEnd: ramadan.end || null,
    });
    setSaved(ok);
  }

  const located = prefs.city !== null && prefs.method !== null;
  return (
    <section className="card setting-card local-calendar" aria-labelledby="local-calendar-title">
      <div className="split-head"><h3 id="local-calendar-title">Local calendar</h3></div>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
        Weeks start on Monday, as at UAE schools and universities. The settings below are optional and off until you turn them on.
      </p>

      <div className="setting-line">
        <div><strong>Hijri dates</strong><p>Show the Umm al-Qura date next to each day on your schedule. It can differ by a day from the official moon sighting.</p></div>
        <Switch checked={prefs.showHijri} onChange={(v) => void save({ ...prefs, showHijri: v })} label="Show Hijri dates" disabled={busy} />
      </div>
      <div className="setting-line">
        <div><strong>Friday prayer</strong><p>No study blocks between 12:00 and 14:00 on Fridays. Your minutes for the day move to after the break.</p></div>
        <Switch checked={prefs.fridayPrayer} onChange={(v) => void save({ ...prefs, fridayPrayer: v })} label="Friday prayer break" disabled={busy} />
      </div>

      <div className="form-grid" style={{ marginTop: 6 }}>
        <div className="field">
          <label htmlFor="prayer-city">City for prayer times</label>
          <select id="prayer-city" className="select" value={prefs.city ?? ""} onChange={(e) => chooseCity(e.target.value)} disabled={busy}>
            <option value="">No city chosen</option>
            {(Object.keys(UAE_CITIES) as UaeCity[]).map((key) => <option key={key} value={key}>{UAE_CITIES[key].label}</option>)}
          </select>
          <span className="field-hint">Only the city is saved. CatchUp never asks for your device&apos;s location.</span>
        </div>
        <div className="field">
          <label htmlFor="prayer-method">Calculation method</label>
          <select id="prayer-method" className="select" value={prefs.method ?? ""} onChange={(e) => void save({ ...prefs, method: e.target.value as PrayerMethod })} disabled={busy || !prefs.city}>
            {prefs.method ? null : <option value="">Choose a city first</option>}
            {(Object.keys(PRAYER_METHODS) as PrayerMethod[]).map((key) => <option key={key} value={key}>{PRAYER_METHODS[key]}</option>)}
          </select>
        </div>
      </div>

      <div className="setting-line">
        <div><strong>Prayer-time breaks</strong><p>A 15-minute break around each of the five daily prayers, from your city&apos;s prayer times. Study resumes after each break.</p></div>
        <Switch checked={prefs.prayerBreaks} onChange={(v) => void save({ ...prefs, prayerBreaks: v })} label="Prayer-time breaks" disabled={busy || !located} />
      </div>
      <div className="setting-line">
        <div><strong>Ramadan</strong><p>Study less each day, and keep the hour before Maghrib and 30 minutes after it free. Dates follow the Umm al-Qura calendar unless you set your own.</p></div>
        <Switch checked={prefs.ramadanMode} onChange={(v) => void save({ ...prefs, ramadanMode: v })} label="Ramadan mode" disabled={busy || !located} />
      </div>

      {prefs.ramadanMode ? (
        <form className="form-grid" onSubmit={saveRamadan} aria-label="Ramadan settings">
          <div className="field">
            <label htmlFor="ramadan-reduction">Reduce daily study by</label>
            <select id="ramadan-reduction" className="select" value={String(ramadan.reduction)} onChange={(e) => setRamadan((r) => ({ ...r, reduction: Number(e.target.value) }))}>
              {REDUCTIONS.map((p) => <option key={p} value={String(p)}>{p}%</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ramadan-start-time">Start time on Ramadan days</label>
            <input id="ramadan-start-time" className="input" type="time" value={ramadan.studyStart} onChange={(e) => setRamadan((r) => ({ ...r, studyStart: e.target.value }))} />
            <span className="field-hint">Optional, e.g. 21:30 for late-evening study. Empty keeps your usual time.</span>
          </div>
          <div className="field">
            <label htmlFor="ramadan-first-day">First day (optional)</label>
            <input id="ramadan-first-day" className="input" type="date" value={ramadan.start} onChange={(e) => setRamadan((r) => ({ ...r, start: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="ramadan-last-day">Last day (optional)</label>
            <input id="ramadan-last-day" className="input" type="date" value={ramadan.end} onChange={(e) => setRamadan((r) => ({ ...r, end: e.target.value }))} />
            <span className="field-hint">Set both to follow your local announcement, or leave both empty.</span>
          </div>
          <div className="span-2" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn small" disabled={busy}>Save Ramadan settings</button>
            <span role="status" className="muted" style={{ fontSize: 12 }}>{saved ? "Ramadan settings saved." : ""}</span>
          </div>
        </form>
      ) : null}

      <p className="muted setting-foot">Changing the prayer or Ramadan settings makes an unapproved draft out of date: compare the routes again before approving. Hijri dates are display only.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
