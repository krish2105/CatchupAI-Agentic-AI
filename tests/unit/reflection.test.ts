import { describe, expect, it } from "vitest";
import { weekStart, weeklyRecommendations, type WeekStats } from "@/lib/insights/reflection";

const base: WeekStats = { blocksCompleted: 0, blocksMissed: 0, blocksUpcoming: 0, focusMinutes: 0, dueRevision: 0, weakExplanations: [], deadlinesNext7: 0, hasActivePlan: false };

describe("weekly recommendations", () => {
  it("puts missed blocks first and caps at three, each citing its number", () => {
    const recs = weeklyRecommendations({ ...base, blocksMissed: 2, hasActivePlan: true, dueRevision: 3, weakExplanations: [{ topic: "residuals", coverage: 38 }], focusMinutes: 10 });
    expect(recs.map((r) => r.href)).toEqual(["/recovery?replan=1", "/quizzes", "/quizzes"]);
    expect(recs[0].title).toBe("Replan around 2 missed blocks");
    expect(recs[2].reason).toContain("38%");
  });

  it("asks for a plan when deadlines approach without one", () => {
    expect(weeklyRecommendations({ ...base, deadlinesNext7: 1 })[0]).toMatchObject({ title: "Approve a recovery route", href: "/recovery" });
  });

  it("falls back to a calm next step instead of inventing work", () => {
    expect(weeklyRecommendations(base)).toEqual([{ title: "Plan next week", reason: expect.any(String), href: "/courses" }]);
    expect(weeklyRecommendations({ ...base, hasActivePlan: true, focusMinutes: 120, blocksUpcoming: 3 })[0].title).toBe("Keep the rhythm");
  });

  it("computes Monday in the student's time zone", () => {
    // Sunday 23:30 in New York is already Monday in UTC.
    expect(weekStart(Date.parse("2026-11-09T04:30:00Z"), "America/New_York")).toBe("2026-11-02");
    expect(weekStart(Date.parse("2026-11-09T04:30:00Z"), "UTC")).toBe("2026-11-09");
  });
});
