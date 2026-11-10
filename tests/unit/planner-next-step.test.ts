import { describe, expect, it } from "vitest";
import { planScenarios, scaleWeekly, type Availability, type WorkItem } from "@/lib/planner/engine";
import { findNextStep } from "@/lib/planner/next-step";
import { formatMinutes } from "@/lib/time";

const DUBAI: Availability = { timezone: "Asia/Dubai", weeklyMinutes: [90, 90, 90, 90, 90, 0, 0], studyStartTime: "17:00" };
// Monday 2026-11-09 08:00 Dubai (04:00Z)
const MONDAY = Date.parse("2026-11-09T04:00:00Z");
// Friday 2026-11-13, midnight Dubai
const FRIDAY_NIGHT = "2026-11-13T20:00:00.000Z";
const item = (id: string, minutes: number, deadline: string | null, tier: WorkItem["tier"] = "required"): WorkItem => ({
  id, kind: "assignment", title: id, courseId: "c1", assignmentId: id, minutes, deadline, tier,
});
const nextStepFor = (items: WorkItem[], availability = DUBAI) =>
  findNextStep({ items, availability, now: MONDAY, plan: planScenarios({ items, availability, now: MONDAY }) });
const deadlineFirstFits = (items: WorkItem[], weeklyTotal: number) =>
  planScenarios({ items, availability: { ...DUBAI, weeklyMinutes: scaleWeekly(DUBAI.weeklyMinutes, weeklyTotal) }, now: MONDAY }).scenarios.find((s) => s.key === "essential")!.feasible;

describe("findNextStep", () => {
  it("returns null when at least one route fits", () => {
    expect(nextStepFor([item("Worksheet", 120, FRIDAY_NIGHT)])).toBeNull();
  });

  it("returns null when nothing is required", () => {
    expect(nextStepFor([])).toBeNull();
  });

  it("finds the smallest extra weekly time that makes the deadline-first route fit, on the student's own study days", () => {
    const items = [item("Regression worksheet", 600, FRIDAY_NIGHT)];
    const step = nextStepFor(items);
    expect(step?.kind).toBe("more_time");
    if (step?.kind !== "more_time") return;
    expect(step.currentWeekly).toBe(450);
    expect(step.weeklyTotal).toBeGreaterThan(450);
    expect(step.extraPerWeek).toBe(step.weeklyTotal - 450);
    // It really fits at that total, and 5 minutes less does not.
    expect(deadlineFirstFits(items, step.weeklyTotal)).toBe(true);
    expect(deadlineFirstFits(items, step.weeklyTotal - 5)).toBe(false);
    // Extra time only goes on days the student already studies (Monday to Friday).
    expect(step.days.length).toBeGreaterThan(0);
    expect(step.days.every((d) => d.weekday <= 4 && d.extra > 0)).toBe(true);
  });

  it("explains why every route is short, naming the work and both minute figures", () => {
    const step = nextStepFor([item("Regression worksheet", 600, FRIDAY_NIGHT)]);
    expect(step?.why).toContain("Regression worksheet");
    expect(step?.why).toContain(formatMinutes(600));
    expect(step?.why).toContain(formatMinutes(450));
    expect(step?.why).toMatch(/every route/i);
  });

  it("drafts an extension request when no amount of daily study can make the deadline", () => {
    const tuesdayNight = "2026-11-10T20:00:00.000Z";
    const step = nextStepFor([item("Lab report", 2000, tuesdayNight)]);
    expect(step?.kind).toBe("extension");
    if (step?.kind !== "extension") return;
    expect(step.assignmentTitle).toBe("Lab report");
    expect(step.dueAt).toBe(tuesdayNight);
    expect(step.shortMinutes).toBeGreaterThan(0);
    expect(Date.parse(step.proposedDueAt)).toBeGreaterThan(Date.parse(tuesdayNight));
    expect(step.request).toContain("Lab report");
    expect(step.request).toMatch(/extension/i);
  });
});
