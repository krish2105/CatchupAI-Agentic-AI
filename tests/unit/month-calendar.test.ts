import { describe, expect, it } from "vitest";
import { buildMonthView, courseColors, doneLevel, monthGrid, shiftMonth } from "@/lib/planner/month";

const NOW = Date.parse("2026-11-09T06:00:00Z"); // Monday 9 Nov, 10:00 Dubai

describe("month grid", () => {
  it("starts weeks on Monday and pads with the neighbouring months", () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks).toHaveLength(6); // Nov 2026 starts on a Sunday
    expect(weeks[0][0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks.at(-1)!.at(-1)).toEqual({ date: "2026-12-06", inMonth: false });
    expect(weeks.flat().every((d, i, all) => i === 0 || Date.parse(`${d.date}T00:00:00Z`) - Date.parse(`${all[i - 1].date}T00:00:00Z`) === 86400_000)).toBe(true);
  });

  it("uses exactly 5 weeks when the month fits", () => {
    expect(monthGrid(2027, 3)).toHaveLength(5); // Mar 2027 starts on a Monday, 31 days
  });

  it("moves between months across year ends", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("month view", () => {
  const base = { year: 2026, month: 11, timezone: "Asia/Dubai", now: NOW, focus: [], revision: [] };

  it("puts items on the student's local day, not the UTC day", () => {
    const view = buildMonthView({
      ...base,
      tasks: [{ id: "t1", title: "Review", courseId: "c1", startsAt: "2026-11-09T21:00:00Z", endsAt: "2026-11-09T22:00:00Z", durationMinutes: 60, status: "todo" }], // 01:00 Dubai on the 10th
      deadlines: [{ id: "a1", title: "Essay", courseId: "c1", dueAt: "2026-11-11T19:59:00Z", required: true, status: "not_started" }], // 23:59 Dubai on the 11th
    });
    const day = (d: string) => view.weeks.flat().find((x) => x.date === d)!;
    expect(day("2026-11-10").blocks.map((b) => b.id)).toEqual(["t1"]);
    expect(day("2026-11-09").blocks).toEqual([]);
    expect(day("2026-11-11").deadlines.map((d) => d.id)).toEqual(["a1"]);
    expect(day("2026-11-09").isToday).toBe(true);
    expect(view.label).toBe("November 2026");
  });

  it("marks blocks done, to do or missed, and overdue deadlines, from data and the clock only", () => {
    const view = buildMonthView({
      ...base,
      tasks: [
        { id: "done", title: "A", courseId: "c1", startsAt: "2026-11-05T13:00:00Z", endsAt: "2026-11-05T14:00:00Z", durationMinutes: 60, status: "completed" },
        { id: "missed", title: "B", courseId: "c1", startsAt: "2026-11-06T13:00:00Z", endsAt: "2026-11-06T14:00:00Z", durationMinutes: 60, status: "todo" },
        { id: "later", title: "C", courseId: "c1", startsAt: "2026-11-12T13:00:00Z", endsAt: "2026-11-12T14:00:00Z", durationMinutes: 60, status: "todo" },
        { id: "gone", title: "D", courseId: "c1", startsAt: "2026-11-12T15:00:00Z", endsAt: "2026-11-12T16:00:00Z", durationMinutes: 60, status: "cancelled" },
      ],
      deadlines: [
        { id: "late", title: "Lab", courseId: "c1", dueAt: "2026-11-02T10:00:00Z", required: true, status: "not_started" },
        { id: "handed", title: "Quiz", courseId: "c1", dueAt: "2026-11-03T10:00:00Z", required: true, status: "completed" },
      ],
    });
    const all = view.weeks.flat();
    const block = (id: string) => all.flatMap((d) => d.blocks).find((b) => b.id === id);
    expect(block("done")!.state).toBe("done");
    expect(block("missed")!.state).toBe("missed");
    expect(block("later")!.state).toBe("todo");
    expect(block("gone")).toBeUndefined(); // cancelled blocks aren't shown
    const deadline = (id: string) => all.flatMap((d) => d.deadlines).find((x) => x.id === id)!;
    expect(deadline("late").overdue).toBe(true);
    expect(deadline("handed").overdue).toBe(false);
    expect(view.totals).toMatchObject({ blocks: 3, done: 1, missed: 1, deadlines: 2, drafts: 0 });
  });

  it("labels each day for screen readers with the full date and what's on it", () => {
    const view = buildMonthView({
      ...base,
      tasks: [
        { id: "x", title: "A", courseId: "c1", startsAt: "2026-11-09T13:00:00Z", endsAt: "2026-11-09T14:00:00Z", durationMinutes: 60, status: "todo" },
        { id: "y", title: "B", courseId: "c1", startsAt: "2026-11-09T14:10:00Z", endsAt: "2026-11-09T15:00:00Z", durationMinutes: 50, status: "completed" },
      ],
      deadlines: [{ id: "a", title: "Essay", courseId: "c1", dueAt: "2026-11-09T15:00:00Z", required: true, status: "in_progress" }],
      focus: [{ startedAt: "2026-11-09T12:00:00Z", focusedMinutes: 25 }],
      revision: [{ dueAt: "2026-11-09T05:00:00Z" }, { dueAt: "2026-11-09T07:00:00Z" }],
    });
    const day = view.weeks.flat().find((d) => d.date === "2026-11-09")!;
    expect(day.label).toBe("Today, Monday 9 November: 1 deadline, 2 study blocks (1 done), 25 focus minutes, 2 revision items due");
    expect(day.focusMinutes).toBe(25);
    expect(day.revisionDue).toBe(2);
    expect(view.weeks.flat().find((d) => d.date === "2026-11-10")!.label).toBe("Tuesday 10 November: nothing planned");
  });

  it("handles a daylight-saving change without losing or doubling a day", () => {
    const view = buildMonthView({ ...base, year: 2026, month: 3, timezone: "Europe/London", tasks: [], deadlines: [] });
    const dates = view.weeks.flat().map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toContain("2026-03-29"); // clocks go forward in the UK
  });
});

describe("done shading, drafts and course colours", () => {
  const base = { year: 2026, month: 11, timezone: "Asia/Dubai", now: NOW, focus: [], revision: [], deadlines: [] };
  const task = (id: string, startsAt: string, minutes: number, status: "todo" | "completed" = "completed", courseId = "c1") => ({
    id, title: `Block ${id}`, courseId, startsAt, endsAt: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(), durationMinutes: minutes, status,
  });

  it("sums completed block minutes per local day and maps them to fixed shading levels", () => {
    expect([0, 1, 29, 30, 59, 60, 119, 120, 400].map(doneLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    const view = buildMonthView({
      ...base,
      tasks: [task("t1", "2026-11-03T06:00:00Z", 30), task("t2", "2026-11-03T08:00:00Z", 45), task("t3", "2026-11-03T10:00:00Z", 60, "todo"), task("t4", "2026-11-04T06:00:00Z", 20)],
    });
    const day = (d: string) => view.weeks.flat().find((x) => x.date === d)!;
    expect(day("2026-11-03")).toMatchObject({ doneMinutes: 75, level: 3 });
    expect(day("2026-11-03").doneLabel).toBe("Tuesday 3 November: 75 minutes of study done");
    expect(day("2026-11-04")).toMatchObject({ doneMinutes: 20, level: 1 });
    expect(day("2026-11-05")).toMatchObject({ doneMinutes: 0, level: 0, doneLabel: "Thursday 5 November: no study done" });
    expect(view.totals.doneMinutes).toBe(95);
  });

  it("shows draft blocks on their day as not approved, outside the totals", () => {
    const view = buildMonthView({
      ...base,
      tasks: [],
      drafts: [task("d1", "2026-11-12T21:00:00Z", 40, "todo"), task("d2", "2026-11-12T05:00:00Z", 30, "todo")], // 01:00 Dubai on the 13th; 09:00 on the 12th
    });
    const day = (d: string) => view.weeks.flat().find((x) => x.date === d)!;
    expect(day("2026-11-13").drafts.map((b) => b.id)).toEqual(["d1"]);
    expect(day("2026-11-12").drafts.map((b) => b.id)).toEqual(["d2"]);
    expect(day("2026-11-12").label).toBe("Thursday 12 November: 1 draft block awaiting approval");
    expect(view.totals).toMatchObject({ blocks: 0, drafts: 2 });
  });

  it("gives each course a stable colour slot in the order given, wrapping after six", () => {
    const colors = courseColors(["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    expect([colors.c1, colors.c2, colors.c6, colors.c7]).toEqual([0, 1, 5, 0]);
  });
});
