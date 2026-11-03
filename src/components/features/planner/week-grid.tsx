"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import type { StudyTask } from "@/lib/db/tasks";
import { formatMinutes } from "@/lib/time";

type Deadline = { id: string; title: string; dueAt: string };

const HOUR_PX = 44;

/** Week calendar of approved blocks and assignment deadlines, positioned in the student's own time zone. */
export default function WeekGrid({
  tasks,
  deadlines,
  timezone,
  weekStart,
  offset,
  courseNames,
  onToggle,
  pending,
}: {
  tasks: StudyTask[];
  deadlines: Deadline[];
  timezone: string;
  weekStart: string;
  offset: number;
  courseNames: Record<string, string>;
  onToggle: (task: StudyTask) => void;
  pending: string | null;
}) {
  const start = new TZDate(Date.parse(weekStart), timezone);
  const days = Array.from({ length: 7 }, (_, i) => new TZDate(start.getFullYear(), start.getMonth(), start.getDate() + i, 0, 0, 0, timezone));
  const end = days[6].getTime() + 86400_000;
  const inWeek = tasks.filter((t) => Date.parse(t.startsAt) >= start.getTime() && Date.parse(t.startsAt) < end && t.status !== "cancelled");
  const local = (iso: string) => new TZDate(Date.parse(iso), timezone);
  const minuteOfDay = (d: TZDate) => d.getHours() * 60 + d.getMinutes();
  const firstHour = Math.max(0, Math.min(8, ...inWeek.map((t) => local(t.startsAt).getHours())));
  const lastHour = Math.min(24, Math.max(18, ...inWeek.map((t) => { const e = local(t.endsAt); return e.getHours() + (e.getMinutes() ? 1 : 0); })));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const sameDay = (a: TZDate, b: TZDate) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short" });

  return (
    <div className="card week-card">
      <div className="split-head week-head">
        <h3>{label.format(days[0])} – {label.format(days[6])}</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <Link className="icon-btn" href={`/planner?week=${offset - 1}`} aria-label="Previous week"><ChevronLeft className="ic" aria-hidden="true" /></Link>
          <Link className="btn small" href="/planner" aria-current={offset === 0 ? "true" : undefined}>This week</Link>
          <Link className="icon-btn" href={`/planner?week=${offset + 1}`} aria-label="Next week"><ChevronRight className="ic" aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="week-scroll">
        <div className="week-grid" style={{ "--rows": hours.length, "--hour": `${HOUR_PX}px` } as React.CSSProperties}>
          <div className="week-corner" aria-hidden="true" />
          {days.map((d) => (
            <div key={d.getTime()} className="week-day-head">
              <strong>{new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short" }).format(d)}</strong>
              <span>{d.getDate()}</span>
              {deadlines.filter((x) => sameDay(local(x.dueAt), d)).map((x) => (
                <em key={x.id} className="week-deadline" title={`Due ${new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(x.dueAt))}`}>Due: {x.title}</em>
              ))}
            </div>
          ))}
          <div className="week-hours" aria-hidden="true">
            {hours.map((h) => <span key={h}>{String(h).padStart(2, "0")}:00</span>)}
          </div>
          {days.map((d) => (
            <div key={`col-${d.getTime()}`} className="week-col">
              {inWeek
                .filter((t) => sameDay(local(t.startsAt), d))
                .map((t) => {
                  const s = local(t.startsAt);
                  const top = ((minuteOfDay(s) - firstHour * 60) / 60) * HOUR_PX;
                  const height = Math.max(22, (t.durationMinutes / 60) * HOUR_PX - 3);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`week-block kind-${t.kind}${t.status === "completed" ? " done" : ""}`}
                      style={{ top, height }}
                      onClick={() => onToggle(t)}
                      disabled={pending === t.id}
                      role="checkbox"
                      aria-checked={t.status === "completed"}
                      aria-label={`${t.title}, ${courseNames[t.courseId] ?? "course"}, ${new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(t.startsAt))}, ${formatMinutes(t.durationMinutes)}`}
                    >
                      <strong>{t.status === "completed" ? <Check className="ic" aria-hidden="true" /> : null}{t.title}</strong>
                      <span>{new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(t.startsAt))} · {formatMinutes(t.durationMinutes)}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      {inWeek.length === 0 ? <p className="muted" style={{ fontSize: 12, padding: "0 22px 18px" }}>No approved study blocks this week.</p> : null}
      <div className="week-legend" aria-hidden="true">
        <span><i className="kind-assignment" /> Assignment work</span>
        <span><i className="kind-study" /> Study</span>
        <span><i className="kind-review" /> Review</span>
      </div>
    </div>
  );
}
