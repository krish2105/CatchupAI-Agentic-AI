import { describe, expect, it } from "vitest";
import { chooseRoute, detectSlipping, type CheckinAssignment, type CheckinBlock } from "@/lib/checkin/detect";

const NOW = Date.parse("2026-11-10T08:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(ms).toISOString();
const block = (assignmentId: string | null, startOffsetHours: number, minutes: number, status: CheckinBlock["status"] = "todo"): CheckinBlock => ({
  assignmentId,
  startsAt: at(NOW + startOffsetHours * HOUR),
  endsAt: at(NOW + startOffsetHours * HOUR + minutes * 60_000),
  durationMinutes: minutes,
  status,
});
const assignment = (id: string, title: string, estimatedMinutes: number, dueInDays: number, over: Partial<CheckinAssignment> = {}): CheckinAssignment => ({
  id, title, courseId: "c1", dueAt: at(NOW + dueInDays * DAY), estimatedMinutes, status: "todo", required: true, ...over,
});

describe("detectSlipping", () => {
  it("is quiet when every block is on time and the plan still covers the work", () => {
    const result = detectSlipping({
      now: NOW,
      assignments: [assignment("w", "Worksheet", 120, 3)],
      activeTasks: [block("w", -20, 60, "completed"), block("w", 5, 60)],
      completedTasks: [block("w", -20, 60, "completed")],
    });
    expect(result).toEqual({ slipping: false, missed: { count: 0, minutes: 0 }, notFitting: [], reason: "" });
  });

  it("counts only unfinished blocks whose time has passed", () => {
    const result = detectSlipping({
      now: NOW,
      assignments: [],
      activeTasks: [block(null, -30, 30), block(null, -3, 45), block(null, -10, 60, "completed"), block(null, -50, 30, "cancelled"), block(null, 2, 30)],
      completedTasks: [],
    });
    expect(result.missed).toEqual({ count: 2, minutes: 75 });
    expect(result.slipping).toBe(true);
  });

  it("lists required work that no longer fits before its deadline, and nothing else", () => {
    const result = detectSlipping({
      now: NOW,
      assignments: [
        assignment("w", "Worksheet", 180, 3), // 60 done + 75 still scheduled → 45 short
        assignment("o", "Optional reading", 120, 3, { required: false }),
        assignment("late", "Overdue lab", 60, -1),
        assignment("done", "Essay", 60, 2, { status: "completed" }),
        assignment("far", "Final project", 600, 30),
      ],
      activeTasks: [block("w", -30, 60, "completed"), block("w", 4, 75)],
      completedTasks: [block("w", -30, 60, "completed")],
    });
    expect(result.notFitting).toEqual([{ id: "w", title: "Worksheet", shortMinutes: 45, dueAt: at(NOW + 3 * DAY) }]);
    expect(result.slipping).toBe(true);
  });

  it("explains why in one short sentence", () => {
    const both = detectSlipping({
      now: NOW,
      assignments: [assignment("w", "Worksheet", 180, 3)],
      activeTasks: [block("w", -30, 30), block("w", -6, 45), block("w", 4, 60)],
      completedTasks: [],
    });
    expect(both.reason).toBe("2 blocks missed (75 min); Worksheet no longer fits by 120 min");

    const one = detectSlipping({ now: NOW, assignments: [], activeTasks: [block(null, -2, 30)], completedTasks: [] });
    expect(one.reason).toBe("1 block missed (30 min)");

    const many = detectSlipping({
      now: NOW,
      assignments: [assignment("a", "Lab report", 60, 1), assignment("b", "Problem set", 90, 2), assignment("c", "Quiz prep", 30, 4)],
      activeTasks: [],
      completedTasks: [],
    });
    expect(many.reason).toBe("Lab report no longer fits by 60 min; Problem set no longer fits by 90 min; and 1 more");
  });
});

describe("chooseRoute", () => {
  const plan = (balanced: boolean, essential: boolean) => ({
    scenarios: [
      { key: "essential" as const, feasible: essential },
      { key: "balanced" as const, feasible: balanced },
      { key: "full" as const, feasible: false },
    ],
  });

  it("prefers the balanced route, then deadline first, even if nothing fits", () => {
    expect(chooseRoute(plan(true, true))).toBe("balanced");
    expect(chooseRoute(plan(false, true))).toBe("essential");
    expect(chooseRoute(plan(false, false))).toBe("essential");
  });
});
