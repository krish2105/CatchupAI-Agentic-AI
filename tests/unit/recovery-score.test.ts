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

describe("recovery score and clock skew", () => {
  it("counts a block completed 'after now' by a few ms (database clock ahead of the server) on today's score", () => {
    const now = Date.parse("2026-11-04T20:05:11.484Z");
    const tasks = [{ endsAt: "2026-11-04T18:35:11Z", completedAt: "2026-11-04T20:05:11.493Z", status: "completed" }];
    const points = recoveryScoreTimeline(tasks, ["2026-11-04"], end, now);
    expect(points[0]).toMatchObject({ score: 100, due: 1, done: 1 });
  });

  it("still only treats blocks that have ended by now as due today", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    const tasks = [
      { endsAt: "2026-11-04T10:00:00Z", completedAt: null, status: "todo" },
      { endsAt: "2026-11-04T18:00:00Z", completedAt: "2026-11-04T11:00:00Z", status: "completed" }, // done early, not yet due
    ];
    expect(recoveryScoreTimeline(tasks, ["2026-11-04"], end, now)[0]).toMatchObject({ due: 1, done: 0, score: 0 });
  });
});
