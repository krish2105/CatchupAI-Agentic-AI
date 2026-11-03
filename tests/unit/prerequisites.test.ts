import { describe, expect, it } from "vitest";
import { studyOrder, wouldCreateCycle } from "@/lib/universe/prerequisites";

describe("course prerequisites", () => {
  const edges = [
    { courseId: "stats", requiresId: "intro" },
    { courseId: "ml", requiresId: "stats" },
  ];

  it("detects direct, transitive and self cycles", () => {
    expect(wouldCreateCycle(edges, "intro", "ml")).toBe(true);
    expect(wouldCreateCycle(edges, "intro", "stats")).toBe(true);
    expect(wouldCreateCycle(edges, "intro", "intro")).toBe(true);
    expect(wouldCreateCycle(edges, "ml", "intro")).toBe(false);
  });

  it("orders foundations first and keeps unrelated courses in place", () => {
    expect(studyOrder(["ml", "art", "stats", "intro"], edges)).toEqual(["art", "intro", "stats", "ml"]);
    expect(studyOrder(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
