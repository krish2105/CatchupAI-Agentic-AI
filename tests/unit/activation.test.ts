import { describe, expect, it } from "vitest";
import { ACTIVATION_STEPS, activationProgress, median } from "@/lib/activation/steps";

const none = { courses: 0, readyDocuments: 0, assignments: 0, approvedPlans: 0, completedBlocks: 0, copilotRuns: 0, quizAttempts: 0 };

describe("activation checklist", () => {
  it("lists seven steps in the order that leads to the first finished study block", () => {
    expect(ACTIVATION_STEPS.map((s) => s.id)).toEqual(["course", "deadline", "notes", "copilot", "plan", "block", "check"]);
    expect(ACTIVATION_STEPS.every((s) => s.href.startsWith("/"))).toBe(true);
  });

  it("marks steps done from real counts and points to the first step not done", () => {
    const p = activationProgress({ ...none, courses: 1, assignments: 2 });
    expect(p.done).toBe(2);
    expect(p.next?.id).toBe("notes");
    expect(p.activated).toBe(false);
  });

  it("counts a student as activated once a plan is approved and a block is finished, even with optional steps left", () => {
    const p = activationProgress({ ...none, courses: 1, assignments: 1, approvedPlans: 1, completedBlocks: 1 });
    expect(p.activated).toBe(true);
    expect(p.complete).toBe(false);
    expect(activationProgress({ courses: 1, readyDocuments: 1, assignments: 1, approvedPlans: 1, completedBlocks: 1, copilotRuns: 1, quizAttempts: 1 })).toMatchObject({ complete: true, next: null, done: 7 });
  });

  it("takes the median of a list (time to value)", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
