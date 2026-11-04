import { describe, expect, it } from "vitest";
import { planScenarios, type Availability, type WorkItem } from "@/lib/planner/engine";
import { selfCheckPlan, type CheckablePlan } from "@/lib/planner/self-check";

const DUBAI: Availability = { timezone: "Asia/Dubai", weeklyMinutes: [90, 90, 90, 90, 90, 0, 0], studyStartTime: "17:00" };
const MONDAY = Date.parse("2026-11-09T04:00:00Z"); // 08:00 Dubai
const item = (id: string, minutes: number, deadline: string | null, tier: WorkItem["tier"] = "required"): WorkItem => ({
  id, kind: "assignment", title: id, courseId: "c1", assignmentId: id, minutes, deadline, tier,
});

function scenario(items: WorkItem[], key: "essential" | "balanced" | "full" = "essential"): CheckablePlan {
  const plan = planScenarios({ items, availability: DUBAI, now: MONDAY });
  const s = plan.scenarios.find((x) => x.key === key)!;
  return { items: s.items, tasks: s.tasks, overdue: plan.overdue, summary: { shortfallMinutes: s.shortfallMinutes } };
}
const clone = (p: CheckablePlan): CheckablePlan => JSON.parse(JSON.stringify(p));

describe("plan self-check", () => {
  it("passes a feasible planner result: every block before its deadline, no overlaps, totals match", () => {
    const r = selfCheckPlan(scenario([item("Worksheet", 180, "2026-11-13T19:00:00Z")]));
    expect(r.status).toBe("pass");
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual(["no_overlap", "before_deadline", "minutes_match", "required_covered"]);
    expect(r.summary).toMatch(/^Self-check passed: 2 blocks/);
  });

  it("explains a shortfall instead of hiding it: which item, how many minutes, by when", () => {
    const r = selfCheckPlan(scenario([item("Essay", 400, "2026-11-11T19:00:00Z")]));
    expect(r.status).toBe("shortfall");
    expect(r.shortfalls).toEqual([{ title: "Essay", minutes: expect.any(Number), deadline: "2026-11-11T19:00:00Z" }]);
    expect(r.shortfalls[0].minutes).toBeGreaterThan(0);
    expect(r.checks.find((c) => c.id === "required_covered")).toMatchObject({ ok: false });
    // The schedule itself is still sound.
    expect(r.checks.filter((c) => c.id !== "required_covered").every((c) => c.ok)).toBe(true);
    expect(r.summary).toMatch(/Essay: \d+ min don't fit before its deadline/);
  });

  it("fails a plan whose blocks overlap", () => {
    const p = clone(scenario([item("A", 180, "2026-11-13T19:00:00Z")]));
    p.tasks[1].startsAt = p.tasks[0].startsAt;
    p.tasks[1].endsAt = new Date(Date.parse(p.tasks[0].startsAt) + p.tasks[1].minutes * 60_000).toISOString();
    const r = selfCheckPlan(p);
    expect(r.status).toBe("fail");
    expect(r.checks.find((c) => c.id === "no_overlap")).toMatchObject({ ok: false });
  });

  it("fails a plan with a block that ends after its item's deadline", () => {
    const p = clone(scenario([item("A", 60, "2026-11-13T19:00:00Z")]));
    p.tasks[0].endsAt = "2026-11-14T10:00:00.000Z";
    p.tasks[0].startsAt = "2026-11-14T09:00:00.000Z";
    const r = selfCheckPlan(p);
    expect(r.status).toBe("fail");
    expect(r.checks.find((c) => c.id === "before_deadline")).toMatchObject({ ok: false, detail: expect.stringContaining("A") });
  });

  it("fails when block minutes don't add up to what the plan claims", () => {
    const p = clone(scenario([item("A", 120, "2026-11-13T19:00:00Z")]));
    p.items[0].scheduledMinutes += 30;
    expect(selfCheckPlan(p).checks.find((c) => c.id === "minutes_match")).toMatchObject({ ok: false });
  });

  it("fails a block whose length doesn't match its times", () => {
    const p = clone(scenario([item("A", 60, "2026-11-13T19:00:00Z")]));
    p.tasks[0].minutes = 90;
    expect(selfCheckPlan(p).status).toBe("fail");
  });

  it("reports overdue required work as not scheduled", () => {
    const p = scenario([item("Late lab", 60, "2026-11-08T10:00:00Z"), item("A", 60, "2026-11-13T19:00:00Z")]);
    const r = selfCheckPlan(p);
    expect(r.overdue).toEqual(["Late lab"]);
    expect(r.summary).toContain("1 overdue item is not scheduled");
  });
});
