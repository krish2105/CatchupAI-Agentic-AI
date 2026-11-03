import { describe, expect, it } from "vitest";
import {
  availabilityWindows,
  BLOCK_RULES,
  planScenarios,
  planningHorizon,
  scaleWeekly,
  schedule,
  validateItems,
  type Availability,
  type WorkItem,
} from "@/lib/planner/engine";

const DUBAI: Availability = { timezone: "Asia/Dubai", weeklyMinutes: [90, 90, 90, 90, 90, 0, 0], studyStartTime: "17:00" };
// Monday 2026-11-09 08:00 Dubai (04:00Z)
const MONDAY = Date.parse("2026-11-09T04:00:00Z");
const iso = (s: string) => new Date(s).toISOString();
const item = (id: string, minutes: number, deadline: string | null, tier: WorkItem["tier"] = "required", kind: WorkItem["kind"] = "assignment"): WorkItem => ({
  id, kind, title: id, courseId: "c1", assignmentId: kind === "assignment" ? id : null, minutes, deadline, tier,
});

describe("availabilityWindows", () => {
  it("builds one local-time window per study day and skips zero days", () => {
    const w = availabilityWindows(DUBAI, MONDAY, MONDAY + 7 * 86400_000);
    expect(w).toHaveLength(5);
    expect(new Date(w[0].start).toISOString()).toBe("2026-11-09T13:00:00.000Z"); // 17:00 Dubai
    expect((w[0].end - w[0].start) / 60000).toBe(90);
    expect(new Date(w[4].start).toISOString()).toBe("2026-11-13T13:00:00.000Z"); // Friday
  });

  it("clips a window that is already in progress", () => {
    const w = availabilityWindows(DUBAI, Date.parse("2026-11-09T13:30:00Z"), Date.parse("2026-11-10T00:00:00Z"));
    expect(w).toEqual([{ start: Date.parse("2026-11-09T13:30:00Z"), end: Date.parse("2026-11-09T14:30:00Z") }]);
  });

  it("drops leftovers shorter than the minimum block", () => {
    const w = availabilityWindows(DUBAI, Date.parse("2026-11-09T14:20:00Z"), Date.parse("2026-11-10T00:00:00Z"));
    expect(w).toEqual([]);
  });

  it("keeps the local start time across a DST change", () => {
    const ny: Availability = { timezone: "America/New_York", weeklyMinutes: [60, 60, 60, 60, 60, 60, 60], studyStartTime: "18:00" };
    const w = availabilityWindows(ny, Date.parse("2026-10-31T12:00:00Z"), Date.parse("2026-11-03T00:00:00Z"));
    expect(w.map((x) => new Date(x.start).toISOString())).toEqual(["2026-10-31T22:00:00.000Z", "2026-11-01T23:00:00.000Z", "2026-11-02T23:00:00.000Z"]);
  });

  it("includes a window that started yesterday and runs past midnight", () => {
    const late: Availability = { timezone: "UTC", weeklyMinutes: [180, 180, 180, 180, 180, 180, 180], studyStartTime: "23:00" };
    const w = availabilityWindows(late, Date.parse("2026-11-10T00:30:00Z"), Date.parse("2026-11-10T12:00:00Z"));
    expect(w[0]).toEqual({ start: Date.parse("2026-11-10T00:30:00Z"), end: Date.parse("2026-11-10T02:00:00Z") });
  });
});

describe("schedule", () => {
  it("splits work into ≤90-minute blocks across days", () => {
    const windows = availabilityWindows(DUBAI, MONDAY, MONDAY + 7 * 86400_000);
    const { tasks, outcomes } = schedule([item("worksheet", 240, "2026-11-13T12:00:00Z")], windows, MONDAY + 7 * 86400_000);
    expect(tasks.map((t) => t.minutes)).toEqual([90, 90, 60]);
    expect(tasks.map((t) => t.title)).toEqual(["worksheet (part 1 of 3)", "worksheet (part 2 of 3)", "worksheet (part 3 of 3)"]);
    expect(outcomes[0]).toMatchObject({ status: "scheduled", unscheduledMinutes: 0 });
  });

  it("reports an honest shortfall instead of an impossible timetable", () => {
    const windows = availabilityWindows(DUBAI, MONDAY, MONDAY + 7 * 86400_000);
    // Due Wednesday 12:00Z: only Mon + Tue windows (180 min) are before the deadline.
    const { tasks, outcomes } = schedule([item("big", 540, "2026-11-11T12:00:00Z")], windows, MONDAY + 7 * 86400_000);
    expect(outcomes[0]).toMatchObject({ scheduledMinutes: 180, unscheduledMinutes: 360, status: "partial" });
    expect(tasks.every((t) => Date.parse(t.endsAt) <= Date.parse("2026-11-11T12:00:00Z"))).toBe(true);
  });

  it("orders by earliest deadline regardless of input order", () => {
    const windows = availabilityWindows(DUBAI, MONDAY, MONDAY + 7 * 86400_000);
    const { tasks } = schedule([item("late", 60, "2026-11-14T00:00:00Z"), item("soon", 60, "2026-11-10T00:00:00Z")], windows, MONDAY + 7 * 86400_000);
    expect(tasks[0].itemId).toBe("soon");
  });

  it("does not waste the rest of a window when one item hits its deadline", () => {
    const windows = [{ start: Date.parse("2026-11-09T18:00:00Z"), end: Date.parse("2026-11-09T21:00:00Z") }];
    const { tasks, outcomes } = schedule([item("a", 60, "2026-11-09T18:30:00Z"), item("b", 60, null)], windows, Date.parse("2026-11-16T00:00:00Z"));
    expect(outcomes.find((o) => o.id === "a")).toMatchObject({ scheduledMinutes: 30, status: "partial" });
    expect(tasks.find((t) => t.itemId === "b")).toMatchObject({ startsAt: iso("2026-11-09T18:40:00Z"), minutes: 60 });
  });

  it("inserts a break between consecutive blocks in one window", () => {
    const windows = [{ start: Date.parse("2026-11-09T18:00:00Z"), end: Date.parse("2026-11-09T22:00:00Z") }];
    const { tasks } = schedule([item("a", 120, null)], windows, Date.parse("2026-11-16T00:00:00Z"));
    expect(tasks.map((t) => [t.startsAt, t.endsAt])).toEqual([
      [iso("2026-11-09T18:00:00Z"), iso("2026-11-09T19:30:00Z")],
      [iso("2026-11-09T19:40:00Z"), iso("2026-11-09T20:10:00Z")],
    ]);
  });
});

describe("planScenarios", () => {
  const items: WorkItem[] = [
    item("stats-worksheet", 240, "2026-11-13T12:00:00Z"),
    item("python-exercise", 150, "2026-11-12T12:00:00Z"),
    item("review-regression", 60, "2026-11-13T12:00:00Z", "recommended", "study"),
    item("review-loops", 45, "2026-11-12T12:00:00Z", "recommended", "study"),
    item("extra-practice", 90, null, "optional", "review"),
  ];

  it("builds nested scenarios with honest feasibility", () => {
    const plan = planScenarios({ items, availability: DUBAI, now: MONDAY });
    const [essential, balanced, full] = plan.scenarios;
    expect(essential.items.map((i) => i.id)).toEqual(["stats-worksheet", "python-exercise", "review-regression"]);
    expect(balanced.items).toHaveLength(4);
    expect(full.items).toHaveLength(5);
    // Mon–Thu windows before the Thursday deadline = 4 × 90 = 360 min; essential needs 450 → not feasible.
    expect(essential).toMatchObject({ requiredMinutes: 450, feasible: false });
    expect(essential.shortfallMinutes).toBeGreaterThan(0);
    expect(essential.scheduledMinutes + essential.shortfallMinutes).toBe(essential.requiredMinutes);
  });

  it("becomes feasible with more availability", () => {
    const roomy: Availability = { ...DUBAI, weeklyMinutes: [240, 240, 240, 240, 240, 120, 120] };
    const plan = planScenarios({ items, availability: roomy, now: MONDAY });
    expect(plan.scenarios.map((s) => s.feasible)).toEqual([true, true, true]);
    expect(plan.scenarios[2].coveragePercent).toBe(100);
  });

  it("excludes and reports overdue required work", () => {
    const plan = planScenarios({ items: [...items, item("missed-quiz", 30, "2026-11-08T00:00:00Z")], availability: DUBAI, now: MONDAY });
    expect(plan.overdue).toEqual([{ id: "missed-quiz", title: "missed-quiz", deadline: "2026-11-08T00:00:00Z", minutes: 30 }]);
    expect(plan.scenarios[2].items.map((i) => i.id)).not.toContain("missed-quiz");
  });

  it("marks an empty plan as not feasible (nothing to approve)", () => {
    const plan = planScenarios({ items: [], availability: DUBAI, now: MONDAY });
    expect(plan.scenarios.every((s) => !s.feasible && s.requiredMinutes === 0)).toBe(true);
  });

  it("holds scheduling invariants on randomized inputs", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 200; run++) {
      const weekly = Array.from({ length: 7 }, () => Math.floor(rand() * 5) * 45);
      const availability: Availability = { timezone: ["Asia/Dubai", "America/New_York", "Europe/London"][run % 3], weeklyMinutes: weekly, studyStartTime: `${String(6 + Math.floor(rand() * 16)).padStart(2, "0")}:${rand() > 0.5 ? "30" : "00"}` };
      const now = MONDAY + Math.floor(rand() * 5 * 86400_000);
      const generated: WorkItem[] = Array.from({ length: 1 + Math.floor(rand() * 7) }, (_, i) =>
        item(`i${i}`, 5 + Math.floor(rand() * 400), rand() > 0.2 ? new Date(now + (0.2 + rand() * 12) * 86400_000).toISOString() : null, (["required", "recommended", "optional"] as const)[Math.floor(rand() * 3)]),
      );
      const plan = planScenarios({ items: generated, availability, now });
      const windows = availabilityWindows(availability, Date.parse(plan.horizon.start), Date.parse(plan.horizon.end));
      for (const s of plan.scenarios) {
        const sorted = [...s.tasks].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        for (let i = 0; i < sorted.length; i++) {
          const t = sorted[i];
          const start = Date.parse(t.startsAt);
          const end = Date.parse(t.endsAt);
          expect(t.minutes).toBeGreaterThan(0);
          expect(t.minutes).toBeLessThanOrEqual(BLOCK_RULES.maxBlockMinutes);
          expect(windows.some((w) => start >= w.start && end <= w.end)).toBe(true);
          if (i > 0) expect(start).toBeGreaterThanOrEqual(Date.parse(sorted[i - 1].endsAt));
          const source = generated.find((g) => g.id === t.itemId)!;
          if (source.deadline) expect(end).toBeLessThanOrEqual(Date.parse(source.deadline));
          expect(start).toBeGreaterThanOrEqual(now);
        }
        for (const o of s.items) expect(o.scheduledMinutes + o.unscheduledMinutes).toBe(o.minutes);
        expect(s.feasible).toBe(s.requiredMinutes > 0 && s.shortfallMinutes === 0);
      }
    }
  });
});

describe("helpers", () => {
  it("bounds the horizon between 7 and 21 days", () => {
    expect(planningHorizon([], MONDAY).end - MONDAY).toBe(7 * 86400_000);
    expect(planningHorizon([item("far", 60, new Date(MONDAY + 60 * 86400_000).toISOString())], MONDAY).end - MONDAY).toBe(21 * 86400_000);
  });

  it("rejects duplicate ids and invalid durations", () => {
    expect(() => validateItems([item("a", 30, null), item("a", 30, null)])).toThrow(/Duplicate/);
    expect(() => validateItems([item("a", 0, null)])).toThrow(/Invalid minutes/);
  });

  it("scales weekly availability preserving the pattern", () => {
    expect(scaleWeekly([90, 90, 90, 90, 90, 0, 0], 900)).toEqual([180, 180, 180, 180, 180, 0, 0]);
    expect(scaleWeekly([0, 0, 0, 0, 0, 0, 0], 700)).toEqual([100, 100, 100, 100, 100, 100, 100]);
  });
});

describe("deadline-bounded capacity", () => {
  it("reports study time before the route's last deadline", () => {
    const plan = planScenarios({ items: [item("w", 300, "2026-11-11T12:00:00Z")], availability: DUBAI, now: MONDAY });
    // Mon + Tue windows end before Wed 12:00Z; the horizon (7 days) has 5 windows.
    expect(plan.scenarios[0]).toMatchObject({ availableBeforeDeadlineMinutes: 180, availableMinutes: 450, shortfallMinutes: 120, lastDeadline: "2026-11-11T12:00:00.000Z" });
  });
});
