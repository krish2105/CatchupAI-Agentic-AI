"use client";

import { Check, ChevronLeft, ChevronRight, Circle, CircleDashed, Flag, Leaf, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Chip } from "@/components/ui/primitives";
import { hijriLabel } from "@/lib/planner/hijri";
import { buildMonthView, courseColors, localDate, shiftMonth, type MonthDeadline, type MonthTask } from "@/lib/planner/month";

const WEEKDAYS = [["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"], ["Sun", "Sunday"]] as const;
const DAY = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * Month view of the study schedule. Built as a native table with one button per day (screen readers hear the
 * full date and what's on it; arrows, Home/End and PageUp/PageDown move between days and months). Status is
 * never colour alone: deadlines are flags, done blocks ticks, missed blocks crosses, upcoming blocks circles.
 * Nothing can be dragged: plan changes go through the Recovery lab and the student's approval. Blocks of a
 * pending draft show as dotted "draft" marks and can only be accepted in the lab's approval dialog.
 *
 * mode "done" (Insights) shades each day by completed study minutes on fixed steps and prints the minutes, with a
 * table alternative, instead of a separate heatmap. Colour marks the course; the icon marks the status.
 */
export default function MonthCalendar({
  timezone,
  now,
  tasks,
  deadlines,
  focus,
  revision,
  courseNames,
  onToggle,
  pending,
  mode = "plan",
  drafts,
  draftHref,
  showHijri = false,
}: {
  timezone: string;
  now: number;
  tasks: MonthTask[];
  deadlines: MonthDeadline[];
  focus: { startedAt: string; focusedMinutes: number }[];
  revision: { dueAt: string }[];
  courseNames: Record<string, string>;
  onToggle?: (taskId: string) => void;
  pending?: string | null;
  mode?: "plan" | "done";
  /** Blocks of the pending draft plan, shown dotted until approved. */
  drafts?: Omit<MonthTask, "status">[];
  /** Where the draft is reviewed and approved (the Recovery lab's approval dialog). */
  draftHref?: string;
  /** Show the Umm al-Qura date of the selected day (Local calendar setting). */
  showHijri?: boolean;
}) {
  const today = localDate(now, timezone);
  const [selected, setSelected] = useState(today);
  const [shown, setShown] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const table = useRef<HTMLTableElement>(null);
  const [asTable, setAsTable] = useState(false);
  const done = mode === "done";
  const view = useMemo(() => buildMonthView({ ...shown, timezone, now, tasks, deadlines, focus, revision, drafts }), [shown, timezone, now, tasks, deadlines, focus, revision, drafts]);
  const colors = useMemo(() => courseColors(Object.keys(courseNames)), [courseNames]);
  const swatch = (courseId: string) => <span className="course-swatch" data-course={colors[courseId] ?? 0} aria-hidden="true" />;
  const usedCourses = Object.keys(courseNames).filter((id) => view.weeks.flat().some((d) => d.inMonth && (d.blocks.some((b) => b.courseId === id) || d.deadlines.some((x) => x.courseId === id) || d.drafts.some((x) => x.courseId === id))));
  const days = view.weeks.flat();
  const day = days.find((d) => d.date === selected) ?? null;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });

  function select(date: string, focusIt = true) {
    setSelected(date);
    const target = { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
    if (target.year !== shown.year || target.month !== shown.month) setShown(target);
    if (focusIt) requestAnimationFrame(() => table.current?.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)?.focus());
  }

  function moveMonth(by: number) {
    const next = shiftMonth(shown, by);
    setShown(next);
    // Keep the same day number where possible (31 Jan → 28 Feb).
    const last = new Date(Date.UTC(next.year, next.month, 0)).getUTCDate();
    setSelected(`${next.year}-${String(next.month).padStart(2, "0")}-${String(Math.min(Number(selected.slice(8, 10)), last)).padStart(2, "0")}`);
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, date: string) {
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      Home: () => addDays(date, -weekday),
      End: () => addDays(date, 6 - weekday),
      PageUp: () => { const m = shiftMonth({ year: +date.slice(0, 4), month: +date.slice(5, 7) }, -1); return clampDay(m, date); },
      PageDown: () => { const m = shiftMonth({ year: +date.slice(0, 4), month: +date.slice(5, 7) }, 1); return clampDay(m, date); },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    select(move());
  }

  const missedInDay = day?.blocks.filter((b) => b.state === "missed").length ?? 0;

  return (
    <section className="card month-cal" aria-labelledby="month-cal-title">
      <div className="month-cal-head">
        <h3 id="month-cal-title" aria-live="polite">{done ? `Study done · ${view.label}` : view.label}</h3>
        <div className="month-cal-nav">
          <button type="button" className="btn small icon-only" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft className="ic" aria-hidden="true" /></button>
          <button type="button" className="btn small" onClick={() => select(today, false)}>Today</button>
          <button type="button" className="btn small icon-only" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight className="ic" aria-hidden="true" /></button>
        </div>
      </div>
      {done ? (
        <div className="month-cal-done-head">
          <p className="muted month-cal-summary">{view.totals.doneMinutes ? `${view.totals.doneMinutes} minutes of study done this month, from completed study blocks (each on the day it was scheduled)` : "No completed study blocks this month yet"}</p>
          <button type="button" className="btn small" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? "Show as calendar" : "Show as table"}</button>
        </div>
      ) : (
        <p className="muted month-cal-summary">
          {view.totals.blocks ? `${view.totals.blocks} study block${view.totals.blocks === 1 ? "" : "s"} · ${view.totals.done} done · ${view.totals.missed} missed` : "No study blocks this month"} · {view.totals.deadlines} deadline{view.totals.deadlines === 1 ? "" : "s"}
          {view.totals.drafts ? ` · ${view.totals.drafts} draft block${view.totals.drafts === 1 ? "" : "s"} awaiting approval` : ""}
        </p>
      )}

      {done && asTable ? (
        <table className="data-table month-done-table">
          <caption className="visually-hidden">Study done per day in {view.label}</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Study done</th><th scope="col">Blocks done</th><th scope="col">Focus minutes</th></tr></thead>
          <tbody>
            {view.weeks.flat().filter((d) => d.inMonth && (d.doneMinutes || d.focusMinutes)).map((d) => (
              <tr key={d.date}>
                <th scope="row">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`))}</th>
                <td>{d.doneMinutes} min</td>
                <td>{d.blocks.filter((b) => b.state === "done").length}</td>
                <td>{d.focusMinutes}</td>
              </tr>
            ))}
            {view.weeks.flat().some((d) => d.inMonth && (d.doneMinutes || d.focusMinutes)) ? null : <tr><td colSpan={4} className="muted">Nothing completed this month yet.</td></tr>}
          </tbody>
        </table>
      ) : null}

      <table className="month-grid" ref={table} hidden={done && asTable} data-mode={mode}>
        <caption className="visually-hidden">{done ? `Study done in ${view.label}, shaded by minutes. Choose a day to see what was completed.` : `Study calendar for ${view.label}. Choose a day to see what is on it.`}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, full]) => (
              <th key={full} scope="col"><span aria-hidden="true">{short}</span><span className="visually-hidden">{full}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((d) => {
                const finished = doneCount(d);
                const missed = d.blocks.filter((b) => b.state === "missed").length;
                const todo = d.blocks.length - doneCount(d) - missed;
                const isSelected = d.date === selected;
                return (
                  <td key={d.date}>
                    <button
                      type="button"
                      data-date={d.date}
                      className="month-day"
                      data-in-month={d.inMonth}
                      data-today={d.isToday || undefined}
                      tabIndex={isSelected ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-current={d.isToday ? "date" : undefined}
                      aria-label={done ? d.doneLabel : d.label}
                      data-level={done && d.inMonth ? d.level : undefined}
                      onClick={() => select(d.date, false)}
                      onKeyDown={(e) => onKey(e, d.date)}
                    >
                      <span className="month-day-num" aria-hidden="true">{Number(d.date.slice(8, 10))}</span>
                      {done ? (
                        <span className="month-day-marks" aria-hidden="true">{d.doneMinutes ? <span className="mark minutes">{d.doneMinutes}m</span> : null}</span>
                      ) : (
                      <span className="month-day-marks" aria-hidden="true">
                        {d.deadlines.length ? <span className={`mark deadline${d.deadlines.some((x) => x.overdue) ? " overdue" : ""}`}><Flag className="ic" />{d.deadlines.length > 1 ? d.deadlines.length : null}</span> : null}
                        {finished ? <span className="mark done"><Check className="ic" />{finished > 1 ? finished : null}</span> : null}
                        {missed ? <span className="mark missed"><X className="ic" />{missed > 1 ? missed : null}</span> : null}
                        {todo ? <span className="mark todo"><Circle className="ic" />{todo > 1 ? todo : null}</span> : null}
                        {d.revisionDue ? <span className="mark revision"><RefreshCw className="ic" /></span> : null}
                        {d.drafts.length ? <span className="mark draft"><CircleDashed className="ic" />{d.drafts.length > 1 ? d.drafts.length : null}</span> : null}
                      </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {done ? (
        <ul className="month-legend" aria-label="Legend" hidden={asTable}>
          {(["None", "Under 30 min", "30–59 min", "1–2 h", "2 h or more"] as const).map((text, level) => (
            <li key={text}><span className="level-swatch" data-level={level} aria-hidden="true" /> {text}</li>
          ))}
        </ul>
      ) : (
        <ul className="month-legend" aria-label="Legend">
          <li><Flag className="ic deadline" aria-hidden="true" /> Deadline</li>
          <li><Circle className="ic todo" aria-hidden="true" /> Study block</li>
          <li><Check className="ic done" aria-hidden="true" /> Done</li>
          <li><X className="ic missed" aria-hidden="true" /> Missed</li>
          <li><RefreshCw className="ic revision" aria-hidden="true" /> Revision due</li>
          {view.totals.drafts ? <li><CircleDashed className="ic draft" aria-hidden="true" /> Draft, not approved</li> : null}
        </ul>
      )}
      {usedCourses.length > 1 ? (
        <ul className="month-legend course-key" aria-label="Course colours">
          {usedCourses.map((id) => <li key={id}>{swatch(id)} {courseNames[id]}</li>)}
        </ul>
      ) : null}

      {day && !(done && asTable) ? (
        <section className="month-day-detail" aria-labelledby="month-day-title">
          <h4 id="month-day-title">{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}{day.isToday ? " · today" : ""}{showHijri ? <span className="hijri-date" suppressHydrationWarning>{hijriLabel(day.date)}</span> : null}</h4>
          {!day.deadlines.length && !day.blocks.length && !day.focusMinutes && !day.revisionDue && !day.drafts.length ? <p className="muted">{done ? "No study done on this day." : "Nothing planned for this day."}</p> : null}
          <ul className="month-items" aria-label="On this day">
            {day.deadlines.map((d) => (
              <li key={d.id} data-kind="deadline">
                <Flag className="ic deadline" aria-hidden="true" />
                <div><strong>Due {time.format(new Date(d.dueAt))} · {d.title}</strong><p className="muted">{swatch(d.courseId)}{courseNames[d.courseId] ?? "Course"}{d.required ? " · required" : " · optional"}</p></div>
                {d.status === "completed" ? <Chip tone="good">Handed in</Chip> : d.overdue ? <Chip tone="danger">Overdue</Chip> : null}
              </li>
            ))}
            {day.blocks.map((b) => (
              <li key={b.id} data-kind={b.state}>
                {b.state === "done" ? <Check className="ic done" aria-hidden="true" /> : b.state === "missed" ? <X className="ic missed" aria-hidden="true" /> : <Circle className="ic todo" aria-hidden="true" />}
                <div><strong>{b.title}</strong><p className="muted">{time.format(new Date(b.startsAt))}–{time.format(new Date(b.endsAt))} · {b.durationMinutes} min · {swatch(b.courseId)}{courseNames[b.courseId] ?? "Course"}</p></div>
                {onToggle ? (
                  <button type="button" className="btn small" onClick={() => onToggle(b.id)} disabled={pending === b.id} aria-label={`Mark “${b.title}” ${b.state === "done" ? "not done" : "done"}`}>
                    {b.state === "done" ? "Undo" : "Mark done"}
                  </button>
                ) : <Chip tone={b.state === "done" ? "good" : b.state === "missed" ? "warn" : undefined}>{b.state === "done" ? "Done" : b.state === "missed" ? "Missed" : "Planned"}</Chip>}
              </li>
            ))}
            {day.drafts.map((b) => (
              <li key={b.id} data-kind="draft">
                <CircleDashed className="ic draft" aria-hidden="true" />
                <div><strong>{b.title}</strong><p className="muted">{time.format(new Date(b.startsAt))}–{time.format(new Date(b.endsAt))} · {b.durationMinutes} min · {swatch(b.courseId)}{courseNames[b.courseId] ?? "Course"}</p></div>
                <Chip>Draft, not approved</Chip>
              </li>
            ))}
            {day.focusMinutes ? <li data-kind="focus"><Leaf className="ic" aria-hidden="true" /><div><strong>{day.focusMinutes} focus minutes</strong><p className="muted">From Focus sanctuary sessions.</p></div></li> : null}
            {day.revisionDue ? <li data-kind="revision"><RefreshCw className="ic revision" aria-hidden="true" /><div><strong>{day.revisionDue} revision item{day.revisionDue === 1 ? "" : "s"} due</strong><p className="muted"><Link href="/quizzes">Practise in the Practice arena</Link></p></div></li> : null}
          </ul>
          {day.drafts.length && draftHref ? <p className="muted">Draft blocks join your schedule only after you approve the plan. <Link href={draftHref}>Review and approve it in the Recovery lab</Link>.</p> : null}
          {missedInDay && !done ? <p className="muted">Missed a block? It isn&apos;t moved automatically. <Link href="/recovery?replan=1">Replan around it</Link> and approve the new route.</p> : null}
        </section>
      ) : null}
    </section>
  );
}

const doneCount = (d: { blocks: { state: string }[] }) => d.blocks.filter((b) => b.state === "done").length;

function clampDay(m: { year: number; month: number }, date: string) {
  const last = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return `${m.year}-${String(m.month).padStart(2, "0")}-${String(Math.min(Number(date.slice(8, 10)), last)).padStart(2, "0")}`;
}
