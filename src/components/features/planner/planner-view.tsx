"use client";

import { Check, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ActivePlan, StudyTask } from "@/lib/db/tasks";
import { formatMinutes } from "@/lib/time";
import { Segmented } from "@/components/ui/controls";
import WeekGrid from "./week-grid";

function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function timeRange(t: StudyTask, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return `${f.format(new Date(t.startsAt))}–${f.format(new Date(t.endsAt))}`;
}

export default function PlannerView({
  plan,
  timezone,
  courseNames,
  now,
  weekStart,
  weekOffset,
  deadlines,
}: {
  plan: ActivePlan;
  timezone: string;
  courseNames: Record<string, string>;
  now: number;
  weekStart: string;
  weekOffset: number;
  deadlines: { id: string; title: string; dueAt: string }[];
}) {
  const [view, setView] = useState<"week" | "list">("week");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tasks = plan.tasks.filter((t) => t.status !== "cancelled");
  const done = tasks.filter((t) => t.status === "completed");
  const doneMinutes = done.reduce((s, t) => s + t.durationMinutes, 0);
  const totalMinutes = tasks.reduce((s, t) => s + t.durationMinutes, 0);

  const days = new Map<string, StudyTask[]>();
  for (const t of tasks) {
    const key = dayKey(t.startsAt, timezone);
    days.set(key, [...(days.get(key) ?? []), t]);
  }
  const today = dayKey(new Date(now).toISOString(), timezone);

  async function toggle(task: StudyTask) {
    setPending(task.id);
    setError(null);
    try {
      await api(`/api/study-tasks/${task.id}`, { method: "PATCH", body: { status: task.status === "completed" ? "todo" : "completed" } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't update the task.");
    } finally {
      setPending(null);
    }
  }

  const progressCard = (
      <div className="card card-inner" aria-live="polite">
        <div className="label">Your progress</div>
        <h3 style={{ fontSize: 23, letterSpacing: "-.9px", margin: "13px 0" }}>{done.length === tasks.length ? "Plan complete. Well done." : "One block at a time."}</h3>
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{plan.title}. Approved {new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.createdAt))}.</p>
        <div className="line" style={{ margin: "23px 0" }} />
        <div className="label">Completed blocks</div>
        <div style={{ fontSize: 42, letterSpacing: "-2px", fontWeight: 800, marginTop: 11 }}>{done.length} / {tasks.length}</div>
        <p className="muted" style={{ fontSize: 12 }}>{formatMinutes(doneMinutes)} of {formatMinutes(totalMinutes)} studied</p>
      </div>
  );

  const toolbar = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <Segmented<"week" | "list"> label="Schedule view" value={view} onChange={setView} options={[{ value: "week", label: "Week" }, { value: "list", label: "List" }]} />
      <span className="muted" style={{ fontSize: 12 }}>Need different times? Adjust your availability in Preferences, then approve a new route in the lab.</span>
    </div>
  );

  if (view === "week") {
    return (
      <>
        {toolbar}
        {error ? <div style={{ marginBottom: 12 }}><Notice tone="danger" title={error} /></div> : null}
        <WeekGrid tasks={plan.tasks} deadlines={deadlines} timezone={timezone} weekStart={weekStart} offset={weekOffset} courseNames={courseNames} onToggle={toggle} pending={pending} />
        <div className="section-space">{progressCard}</div>
      </>
    );
  }

  return (
    <>
    {toolbar}
    <div className="schedule-layout">
      <div className="card">
        <div className="card-inner" style={{ paddingBottom: 10 }}>
          <div className="split-head"><h3>Recovery timeline</h3><Chip tone="good">Approved · {timezone}</Chip></div>
          {error ? <Notice tone="danger" title={error} /> : null}
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Scheduled study blocks by day">
          {[...days.entries()].map(([key, list]) => {
            const date = new Date(`${key}T12:00:00Z`);
            return (
              <li key={key} className="schedule-day" style={{ alignItems: "flex-start" }}>
                <div className="day-number" aria-hidden="true" style={key === today ? { borderColor: "var(--accent)" } : undefined}>
                  <div style={{ textAlign: "center", lineHeight: 1.1 }}>
                    <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date)}</span>
                    {date.getUTCDate()}
                  </div>
                </div>
                <div className="schedule-block" style={{ display: "grid", gap: 12 }}>
                  <span className="visually-hidden">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(date)}{key === today ? " (today)" : ""}</span>
                  {list.map((t) => (
                    <div key={t.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ textDecoration: t.status === "completed" ? "line-through" : undefined, overflowWrap: "anywhere" }}>{t.title}</strong>
                        <p>
                          {timeRange(t, timezone)} · {formatMinutes(t.durationMinutes)} · {courseNames[t.courseId] ?? "Course"}
                        </p>
                        {t.evidence.length ? (
                          <p>
                            {t.evidence.map((e) => (
                              <a key={`${e.documentId}-${e.page}`} className="text-link" style={{ display: "inline-flex", padding: 0, marginRight: 8 }} href={`/api/documents/${e.documentId}/source?page=${e.page}`} target="_blank" rel="noopener noreferrer">
                                <FileText className="ic" aria-hidden="true" /> {e.filename ?? "Source"} · p. {e.page}
                              </a>
                            ))}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`task-check${t.status === "completed" ? " done" : ""}`}
                        role="checkbox"
                        aria-checked={t.status === "completed"}
                        aria-label={`Mark “${t.title}” ${t.status === "completed" ? "not done" : "done"}`}
                        disabled={pending === t.id}
                        onClick={() => toggle(t)}
                      >
                        {t.status === "completed" ? <Check className="ic" aria-hidden="true" /> : null}
                      </button>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {progressCard}
    </div>
    </>
  );
}
