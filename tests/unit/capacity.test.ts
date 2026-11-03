import { describe, expect, it } from "vitest";
import { assessCapacity } from "@/lib/planner/capacity";

describe("assessCapacity", () => {
  it("reports a shortfall when work exceeds available time", () => {
    const result = assessCapacity(540, 360);
    expect(result).toMatchObject({ feasible: false, shortfallMinutes: 180, spareMinutes: 0, coveragePercent: 67 });
  });

  it("reports spare capacity when time exceeds work", () => {
    expect(assessCapacity(120, 300)).toMatchObject({ feasible: true, shortfallMinutes: 0, spareMinutes: 180, coveragePercent: 100 });
  });

  it("treats zero required work as fully covered", () => {
    expect(assessCapacity(0, 0)).toMatchObject({ feasible: true, coveragePercent: 100 });
  });

  it.each([[-1, 10], [10, Number.NaN], [Number.POSITIVE_INFINITY, 10]])("rejects invalid minutes %p/%p", (required, available) => {
    expect(() => assessCapacity(required, available)).toThrow(RangeError);
  });
});
