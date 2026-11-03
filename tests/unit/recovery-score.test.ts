import { describe, expect, it } from "vitest";
import { recoveryScoreTimeline } from "@/lib/insights/recovery-score";

const end = (d: string) => Date.parse(`${d}T23:59:59.999Z`);

describe("recovery score timeline", () => {
  it("is the cumulative share of due blocks completed by each day's end", () => {
    const tasks = [
      { endsAt: "2026-11-02T10:00:00Z", completedAt: "2026-11-02T10:05:00Z", status: "completed" },
      { endsAt: "2026-11-03T10:00:00Z", completedAt: "2026-11-04T09:00:00Z", status: "completed" },
      { endsAt: "2026-11-04T10:00:00Z", completedAt: null, status: "todo" },
      { endsAt: "2026-11-04T12:00:00Z", completedAt: null, status: "cancelled" },
    ];
    const points = recoveryScoreTimeline(tasks, ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"], end);
    expect(points.map((p) => p.score)).toEqual([null, 100, 50, 67]);
    expect(points[3]).toMatchObject({ due: 3, done: 2 });
  });

  it("has no score without any due blocks", () => {
    expect(recoveryScoreTimeline([], ["2026-11-01"], end)).toEqual([{ date: "2026-11-01", score: null, due: 0, done: 0 }]);
  });
});
