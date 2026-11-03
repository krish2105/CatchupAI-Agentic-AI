import { describe, expect, it } from "vitest";
import type { WorkItem } from "@/lib/planner/engine";
import { applyCompletedWork, missedBlocks } from "@/lib/planner/progress";

const item = (id: string, minutes: number, assignmentId: string | null = id): WorkItem => ({
  id: `assignment:${id}`, kind: "assignment", title: id, courseId: "c", assignmentId, minutes, deadline: "2026-11-10T12:00:00Z", tier: "required", rationale: "Required.",
});

describe("replanning after progress", () => {
  it("subtracts completed block minutes and drops fully covered work", () => {
    const out = applyCompletedWork([item("a", 120), item("b", 60), item("review", 30, null)], [
      { assignmentId: "a", durationMinutes: 45 },
      { assignmentId: "a", durationMinutes: 30 },
      { assignmentId: "b", durationMinutes: 90 },
      { assignmentId: null, durationMinutes: 30 },
    ]);
    expect(out.map((i) => [i.title, i.minutes])).toEqual([["a", 45], ["review", 30]]);
    expect(out[0].rationale).toContain("75 min already completed");
  });

  it("leaves items untouched when nothing is completed", () => {
    const items = [item("a", 90)];
    expect(applyCompletedWork(items, [])).toEqual(items);
  });

  it("finds only past, unfinished blocks as missed", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    const tasks = [
      { id: 1, status: "todo" as const, endsAt: "2026-11-04T10:00:00Z", durationMinutes: 60 },
      { id: 2, status: "completed" as const, endsAt: "2026-11-04T09:00:00Z", durationMinutes: 60 },
      { id: 3, status: "todo" as const, endsAt: "2026-11-04T13:00:00Z", durationMinutes: 60 },
      { id: 4, status: "cancelled" as const, endsAt: "2026-11-04T08:00:00Z", durationMinutes: 60 },
    ];
    expect(missedBlocks(tasks, now).map((t) => t.id)).toEqual([1]);
  });
});
