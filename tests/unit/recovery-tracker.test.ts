import { describe, expect, it } from "vitest";
import { assignmentTracker, weekSummary } from "@/lib/insights/tracker";

const NOW = Date.parse("2026-11-11T08:00:00Z"); // Wednesday 11 Nov, 12:00 Dubai
const a = (id: string, minutes: number, dueAt: string, status = "not_started", required = true) => ({ id, title: id, courseId: "c1", dueAt, estimatedMinutes: minutes, status, required });
const block = (assignmentId: string | null, startsAt: string, minutes: number, status: "todo" | "completed" | "cancelled" = "todo") => ({
  assignmentId, startsAt, endsAt: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(), durationMinutes: minutes, status,
});

describe("assignment tracker", () => {
  it("shows done, on track, at risk, not planned and overdue from real minutes", () => {
    const rows = assignmentTracker({
      now: NOW,
      assignments: [
        a("finished", 60, "2026-11-20T10:00:00Z"),
        a("handed-in", 120, "2026-11-20T10:00:00Z", "completed"),
        a("on-track", 120, "2026-11-20T10:00:00Z"),
        a("at-risk", 180, "2026-11-20T10:00:00Z"),
        a("unplanned", 90, "2026-11-20T10:00:00Z"),
        a("late", 60, "2026-11-10T10:00:00Z"),
      ],
      completedTasks: [block("finished", "2026-11-09T13:00:00Z", 60, "completed"), block("on-track", "2026-11-09T13:00:00Z", 60, "completed")],
      activeTasks: [block("on-track", "2026-11-12T13:00:00Z", 60), block("at-risk", "2026-11-12T13:00:00Z", 60), block("at-risk", "2026-11-25T13:00:00Z", 60)],
      checklists: { "on-track": { done: 2, total: 5 } },
    });
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.finished).toMatchObject({ status: "done", doneMinutes: 60, percent: 100 });
    expect(by["handed-in"]).toMatchObject({ status: "done", percent: 100 });
    expect(by["on-track"]).toMatchObject({ status: "on_track", doneMinutes: 60, scheduledMinutes: 60, percent: 50, checklist: { done: 2, total: 5 } });
    // A block after the deadline doesn't count towards it.
    expect(by["at-risk"]).toMatchObject({ status: "at_risk", scheduledMinutes: 60, shortMinutes: 120 });
    expect(by.unplanned).toMatchObject({ status: "unplanned", scheduledMinutes: 0, shortMinutes: 90 });
    expect(by.late).toMatchObject({ status: "overdue" });
  });

  it("orders by what needs attention: overdue, at risk, not planned, on track, done; then by due date", () => {
    const rows = assignmentTracker({
      now: NOW,
      assignments: [a("d2", 60, "2026-11-21T10:00:00Z", "completed"), a("u", 60, "2026-11-19T10:00:00Z"), a("o", 60, "2026-11-10T10:00:00Z"), a("u-early", 60, "2026-11-15T10:00:00Z")],
      completedTasks: [], activeTasks: [], checklists: {},
    });
    expect(rows.map((r) => r.id)).toEqual(["o", "u-early", "u", "d2"]);
  });

  it("caps percent at 100 when more was done than estimated", () => {
    const rows = assignmentTracker({
      now: NOW,
      assignments: [a("big", 60, "2026-11-20T10:00:00Z")],
      completedTasks: [block("big", "2026-11-09T13:00:00Z", 90, "completed")],
      activeTasks: [], checklists: {},
    });
    expect(rows[0]).toMatchObject({ percent: 100, status: "done" });
  });
});

describe("week summary (forgiving: days of 7, fresh start each Monday)", () => {
  it("counts distinct local days with completed study or focus this week, not a streak", () => {
    const s = weekSummary({
      now: NOW,
      timezone: "Asia/Dubai",
      tasks: [
        block(null, "2026-11-09T13:00:00Z", 60, "completed"), // Mon
        block(null, "2026-11-09T15:00:00Z", 30, "completed"), // Mon again
        block(null, "2026-11-10T13:00:00Z", 60, "todo"), // Tue, missed
        block(null, "2026-11-13T13:00:00Z", 60, "todo"), // Fri, upcoming
        block(null, "2026-11-06T13:00:00Z", 60, "completed"), // last week
      ].map((t, i) => ({ ...t, completedAt: t.status === "completed" ? t.endsAt : null, id: String(i) })),
      focus: [{ startedAt: "2026-11-11T05:00:00Z", focusedMinutes: 25 }], // Wed
    });
    expect(s).toEqual({ weekStart: "2026-11-09", daysStudied: 2, plannedMinutes: 210, doneMinutes: 90, focusMinutes: 25, missedBlocks: 1, upcomingBlocks: 1 });
  });
});
