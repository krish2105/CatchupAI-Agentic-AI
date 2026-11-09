import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import { availabilityWindows, BLOCK_RULES, planScenarios, reducedMinutes, type Availability, type CalendarBreak, type WorkItem } from "@/lib/planner/engine";

const MIN = 60_000;
const DAY = 86_400_000;
const at = (s: string) => Date.parse(s);
const minutes = (w: { start: number; end: number }[]) => w.reduce((s, x) => s + (x.end - x.start) / MIN, 0);
const item = (id: string, mins: number, deadline: string | null): WorkItem => ({ id, kind: "assignment", title: id, courseId: "c1", assignmentId: id, minutes: mins, deadline, tier: "required" });

// Friday 13 Nov 2026 in Dubai (UTC+4): prayer window 12:00–14:00 local = 08:00–10:00Z.
const FRIDAY_PRAYER: CalendarBreak = { start: at("2026-11-13T08:00:00Z"), end: at("2026-11-13T10:00:00Z"), reason: "friday_prayer" };
const FRIDAY_ONLY: Availability = { timezone: "Asia/Dubai", weeklyMinutes: [0, 0, 0, 0, 120, 0, 0], studyStartTime: "11:00" };
const WEEK = { from: at("2026-11-09T00:00:00Z"), to: at("2026-11-16T00:00:00Z") };

describe("availabilityWindows with local calendar rules", () => {
  it("is unchanged when there are no rules", () => {
    for (const timezone of ["Asia/Dubai", "America/New_York", "Europe/London"]) {
      const availability: Availability = { timezone, weeklyMinutes: [60, 90, 0, 120, 45, 300, 15], studyStartTime: "18:30" };
      const from = at("2026-10-26T09:00:00Z");
      const plain = availabilityWindows(availability, from, from + 14 * DAY);
      expect(availabilityWindows({ ...availability, calendar: undefined }, from, from + 14 * DAY)).toEqual(plain);
      expect(availabilityWindows({ ...availability, calendar: { breaks: [] } }, from, from + 14 * DAY)).toEqual(plain);
    }
  });

  it("pauses for a break and resumes after it, keeping the day's minutes", () => {
    const w = availabilityWindows({ ...FRIDAY_ONLY, calendar: { breaks: [FRIDAY_PRAYER] } }, WEEK.from, WEEK.to);
    expect(w).toEqual([
      { start: at("2026-11-13T07:00:00Z"), end: at("2026-11-13T08:00:00Z") }, // 11:00–12:00
      { start: at("2026-11-13T10:00:00Z"), end: at("2026-11-13T11:00:00Z") }, // 14:00–15:00
    ]);
    expect(minutes(w)).toBe(120);
  });

  it("starts after a break that covers the start time", () => {
    const w = availabilityWindows({ ...FRIDAY_ONLY, studyStartTime: "12:30", calendar: { breaks: [FRIDAY_PRAYER] } }, WEEK.from, WEEK.to);
    expect(w).toEqual([{ start: at("2026-11-13T10:00:00Z"), end: at("2026-11-13T12:00:00Z") }]); // 14:00–16:00
  });

  it("skips a gap shorter than the minimum block without spending minutes on it", () => {
    const w = availabilityWindows({ ...FRIDAY_ONLY, studyStartTime: "11:50", calendar: { breaks: [FRIDAY_PRAYER] } }, WEEK.from, WEEK.to);
    expect(w).toEqual([{ start: at("2026-11-13T10:00:00Z"), end: at("2026-11-13T12:00:00Z") }]);
  });

  it("merges overlapping breaks", () => {
    const prayer: CalendarBreak = { start: at("2026-11-13T07:55:00Z"), end: at("2026-11-13T08:10:00Z"), reason: "prayer" };
    const w = availabilityWindows({ ...FRIDAY_ONLY, calendar: { breaks: [FRIDAY_PRAYER, prayer] } }, WEEK.from, WEEK.to);
    expect(w).toEqual([
      { start: at("2026-11-13T07:00:00Z"), end: at("2026-11-13T07:55:00Z") },
      { start: at("2026-11-13T10:00:00Z"), end: at("2026-11-13T11:05:00Z") },
    ]);
  });

  it("clips to the requested range after laying out the day", () => {
    const w = availabilityWindows({ ...FRIDAY_ONLY, calendar: { breaks: [FRIDAY_PRAYER] } }, at("2026-11-13T10:30:00Z"), WEEK.to);
    expect(w).toEqual([{ start: at("2026-11-13T10:30:00Z"), end: at("2026-11-13T11:00:00Z") }]);
  });

  it("reduces Ramadan days by the chosen percentage, rounded down to 5 minutes", () => {
    const base: Availability = { timezone: "Asia/Dubai", weeklyMinutes: [120, 100, 100, 100, 100, 100, 100], studyStartTime: "20:00" };
    const ramadanDay = (pct: number, date: string) =>
      minutes(availabilityWindows({ ...base, calendar: { breaks: [], ramadan: { dates: [date], reductionPercent: pct, studyStartTime: null } } }, at(`${date}T00:00:00Z`), at(`${date}T23:59:00Z`)));
    expect(ramadanDay(25, "2026-11-09")).toBe(90); // Monday 120 → 90
    expect(ramadanDay(30, "2026-11-10")).toBe(70); // 100 → 70
    expect(ramadanDay(33, "2026-11-10")).toBe(65); // 100 → 67 → 65
    expect(ramadanDay(0, "2026-11-10")).toBe(100);
    // A day that isn't in the list keeps its minutes.
    const w = availabilityWindows({ ...base, calendar: { breaks: [], ramadan: { dates: ["2026-11-10"], reductionPercent: 50, studyStartTime: null } } }, WEEK.from, at("2026-11-11T00:00:00Z"));
    expect(w.map((x) => (x.end - x.start) / MIN)).toEqual([120, 50]);
  });

  it("uses the Ramadan start time on Ramadan days only", () => {
    const base: Availability = { timezone: "Asia/Dubai", weeklyMinutes: [60, 60, 60, 60, 60, 60, 60], studyStartTime: "17:00" };
    const w = availabilityWindows({ ...base, calendar: { breaks: [], ramadan: { dates: ["2026-11-10"], reductionPercent: 0, studyStartTime: "21:30" } } }, WEEK.from, at("2026-11-12T00:00:00Z"));
    expect(w.map((x) => new TZDate(x.start, "Asia/Dubai").toTimeString().slice(0, 5))).toEqual(["17:00", "21:30", "17:00"]);
  });

  it("never runs into the next day's window", () => {
    // Ramadan day starts 21:00 with 12 hours (to 09:00); the next, ordinary day starts at 08:00.
    const base: Availability = { timezone: "UTC", weeklyMinutes: [720, 720, 720, 720, 720, 720, 720], studyStartTime: "08:00" };
    const w = availabilityWindows({ ...base, calendar: { breaks: [], ramadan: { dates: ["2026-11-10"], reductionPercent: 0, studyStartTime: "21:00" } } }, at("2026-11-10T00:00:00Z"), at("2026-11-12T00:00:00Z"));
    expect(w[0]).toEqual({ start: at("2026-11-10T21:00:00Z"), end: at("2026-11-11T08:00:00Z") });
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].end);
  });
});

describe("planScenarios with local calendar rules", () => {
  it("keeps blocks out of breaks and still schedules all the work", () => {
    const plan = planScenarios({ items: [item("worksheet", 120, "2026-11-14T08:00:00Z")], availability: { ...FRIDAY_ONLY, calendar: { breaks: [FRIDAY_PRAYER] } }, now: WEEK.from });
    const tasks = plan.scenarios[0].tasks;
    expect(tasks.map((t) => [t.startsAt, t.endsAt])).toEqual([
      ["2026-11-13T07:00:00.000Z", "2026-11-13T08:00:00.000Z"],
      ["2026-11-13T10:00:00.000Z", "2026-11-13T11:00:00.000Z"],
    ]);
    expect(plan.scenarios[0].feasible).toBe(true);
  });

  it("holds invariants on randomized rules", () => {
    let seed = 81;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const zones = ["Asia/Dubai", "America/New_York", "Europe/London"];
    for (let run = 0; run < 150; run++) {
      const timezone = zones[run % 3];
      const now = at("2026-10-26T04:00:00Z") + Math.floor(rand() * 10 * DAY);
      const weekly = Array.from({ length: 7 }, () => Math.floor(rand() * 9) * 45);
      const breaks: CalendarBreak[] = Array.from({ length: Math.floor(rand() * 40) }, () => {
        const start = now - DAY + Math.floor(rand() * 23 * DAY / (5 * MIN)) * 5 * MIN;
        return { start, end: start + [15, 60, 120][Math.floor(rand() * 3)] * MIN, reason: "prayer" as const };
      });
      const dates = Array.from({ length: Math.floor(rand() * 12) }, () => new TZDate(now + Math.floor(rand() * 21) * DAY, timezone).toISOString().slice(0, 10));
      const availability: Availability = {
        timezone,
        weeklyMinutes: weekly,
        studyStartTime: `${String(5 + Math.floor(rand() * 18)).padStart(2, "0")}:${rand() > 0.5 ? "30" : "00"}`,
        calendar: { breaks, ramadan: { dates, reductionPercent: Math.floor(rand() * 16) * 5, studyStartTime: rand() > 0.5 ? "21:00" : null } },
      };
      const items = Array.from({ length: 1 + Math.floor(rand() * 6) }, (_, i) => item(`i${i}`, 15 + Math.floor(rand() * 400), new Date(now + (0.5 + rand() * 14) * DAY).toISOString()));
      const plan = planScenarios({ items, availability, now });
      const windows = availabilityWindows(availability, Date.parse(plan.horizon.start), Date.parse(plan.horizon.end));

      for (let i = 0; i < windows.length; i++) {
        const w = windows[i];
        expect(w.end - w.start).toBeGreaterThanOrEqual(BLOCK_RULES.minBlockMinutes * MIN);
        if (i > 0) expect(w.start).toBeGreaterThanOrEqual(windows[i - 1].end);
        for (const b of breaks) expect(w.end <= b.start || w.start >= b.end).toBe(true);
      }
      // Rules move or reduce time; they never add any. Exact bound: each study day contributes at most its own
      // budget (weekly minutes, reduced on Ramadan days), counting every day whose window starts before the end.
      const end = Date.parse(plan.horizon.end);
      const first = new TZDate(Date.parse(plan.horizon.start), timezone);
      let budget = 0;
      for (let offset = -1; ; offset++) {
        const noon = new TZDate(first.getFullYear(), first.getMonth(), first.getDate() + offset, 12, 0, 0, timezone);
        const ymd = `${noon.getFullYear()}-${String(noon.getMonth() + 1).padStart(2, "0")}-${String(noon.getDate()).padStart(2, "0")}`;
        const reduced = availability.calendar!.ramadan!.dates.includes(ymd);
        const [hh, mm] = (reduced && availability.calendar!.ramadan!.studyStartTime ? availability.calendar!.ramadan!.studyStartTime : availability.studyStartTime).split(":").map(Number);
        if (new TZDate(noon.getFullYear(), noon.getMonth(), noon.getDate(), hh, mm, 0, timezone).getTime() >= end) break;
        const base = weekly[(noon.getDay() + 6) % 7];
        budget += reduced ? reducedMinutes(base, availability.calendar!.ramadan!.reductionPercent) : base;
      }
      expect(minutes(windows)).toBeLessThanOrEqual(budget);
      for (const s of plan.scenarios) {
        for (const t of s.tasks) {
          const start = Date.parse(t.startsAt);
          const end = Date.parse(t.endsAt);
          expect(windows.some((w) => start >= w.start && end <= w.end)).toBe(true);
          for (const b of breaks) expect(end <= b.start || start >= b.end).toBe(true);
        }
      }
    }
  });
});
