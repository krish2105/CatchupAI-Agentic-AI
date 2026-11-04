/**
 * Month calendar model (pure, client-safe). Days are plain local dates ("YYYY-MM-DD") in the student's time
 * zone; every item is placed on the local day it happens, so a block at 01:00 Dubai shows on that day even
 * though it is the previous day in UTC. Weeks start on Monday, like the week grid. Nothing here is estimated:
 * block states come from the stored status and the clock, deadlines from assignments.
 */
export type MonthTask = { id: string; title: string; courseId: string; startsAt: string; endsAt: string; durationMinutes: number; status: "todo" | "completed" | "cancelled" };
export type MonthDeadline = { id: string; title: string; courseId: string; dueAt: string; required: boolean; status: string };
export type MonthDay = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  deadlines: (MonthDeadline & { overdue: boolean })[];
  blocks: (Omit<MonthTask, "status"> & { state: "done" | "todo" | "missed" })[];
  focusMinutes: number;
  revisionDue: number;
  /** Full screen-reader label for the day's button. */
  label: string;
};
export type MonthView = { year: number; month: number; label: string; weeks: MonthDay[][]; totals: { blocks: number; done: number; missed: number; deadlines: number } };

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function shiftMonth(m: { year: number; month: number }, by: number) {
  const index = m.year * 12 + (m.month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The calendar grid for a month (1–12): whole Monday-to-Sunday weeks, padded with neighbouring days. */
export function monthGrid(year: number, month: number) {
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(year, month, 0);
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY;
  const weeks: { date: string; inMonth: boolean }[][] = [];
  for (let t = start; t <= last; t += 7 * DAY) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const date = isoDate(t + i * DAY);
      return { date, inMonth: date.slice(0, 7) === `${year}-${pad(month)}` };
    }));
  }
  return weeks;
}

/** Local calendar date of an instant in a time zone. */
export function localDate(at: string | number, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

const longDay = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** " (1 done, 2 missed)" or "" */
function blockDetail(blocks: { state: "done" | "todo" | "missed" }[]) {
  const done = blocks.filter((b) => b.state === "done").length;
  const missed = blocks.filter((b) => b.state === "missed").length;
  const bits = [done ? `${done} done` : null, missed ? `${missed} missed` : null].filter(Boolean);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

export function buildMonthView(input: {
  year: number;
  month: number;
  timezone: string;
  now: number;
  tasks: MonthTask[];
  deadlines: MonthDeadline[];
  focus: { startedAt: string; focusedMinutes: number }[];
  revision: { dueAt: string }[];
}): MonthView {
  const today = localDate(input.now, input.timezone);
  const byDay = <T,>(items: T[], at: (x: T) => string) => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = localDate(at(item), input.timezone);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  };
  const tasks = byDay(input.tasks.filter((t) => t.status !== "cancelled"), (t) => t.startsAt);
  const deadlines = byDay(input.deadlines, (d) => d.dueAt);
  const focus = byDay(input.focus, (f) => f.startedAt);
  const revision = byDay(input.revision, (r) => r.dueAt);

  const weeks = monthGrid(input.year, input.month).map((week) =>
    week.map(({ date, inMonth }): MonthDay => {
      const blocks = (tasks.get(date) ?? [])
        .sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt))
        .map(({ status, ...t }) => ({ ...t, state: status === "completed" ? ("done" as const) : Date.parse(t.endsAt) <= input.now ? ("missed" as const) : ("todo" as const) }));
      const due = (deadlines.get(date) ?? [])
        .sort((x, y) => Date.parse(x.dueAt) - Date.parse(y.dueAt))
        .map((d) => ({ ...d, overdue: d.status !== "completed" && Date.parse(d.dueAt) <= input.now }));
      const focusMinutes = (focus.get(date) ?? []).reduce((s, f) => s + f.focusedMinutes, 0);
      const revisionDue = (revision.get(date) ?? []).length;
      const isToday = date === today;
      const parts = [
        due.length ? `${plural(due.length, "deadline")}${due.some((d) => d.overdue) ? ` (${due.filter((d) => d.overdue).length} overdue)` : ""}` : null,
        blocks.length ? `${plural(blocks.length, "study block")}${blockDetail(blocks)}` : null,
        focusMinutes ? `${focusMinutes} focus minutes` : null,
        revisionDue ? `${plural(revisionDue, "revision item")} due` : null,
      ].filter(Boolean);
      const label = `${isToday ? "Today, " : ""}${longDay(date)}: ${parts.length ? parts.join(", ") : "nothing planned"}`;
      return { date, inMonth, isToday, deadlines: due, blocks, focusMinutes, revisionDue, label };
    }),
  );
  const inMonth = weeks.flat().filter((d) => d.inMonth);
  const allBlocks = inMonth.flatMap((d) => d.blocks);
  return {
    year: input.year,
    month: input.month,
    label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(input.year, input.month - 1, 15))),
    weeks,
    totals: { blocks: allBlocks.length, done: allBlocks.filter((b) => b.state === "done").length, missed: allBlocks.filter((b) => b.state === "missed").length, deadlines: inMonth.reduce((s, d) => s + d.deadlines.length, 0) },
  };
}
