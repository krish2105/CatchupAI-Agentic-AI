import { describe, expect, it } from "vitest";
import { catchupGains, packTopic } from "@/lib/catchup/gain";

describe("catch-up pre/post gain", () => {
  it("labels a pack's checks with one topic per document name", () => {
    expect(packTopic("lecture_5.pdf")).toBe("Catch-up: lecture_5.pdf");
    expect(packTopic("x".repeat(200)).length).toBeLessThanOrEqual(160);
  });

  it("reports before (first attempt) and after (latest) only for packs with both", () => {
    const gains = catchupGains([
      { courseId: "c1", topic: "Catch-up: week5.pdf", baseline: 40, latest: 80, attempts: 3, delta: 40 },
      { courseId: "c1", topic: "Catch-up: week6.pdf", baseline: 60, latest: 60, attempts: 1, delta: 0 },
      { courseId: "c1", topic: "Whole course", baseline: 20, latest: 90, attempts: 4, delta: 70 },
      { courseId: "c2", topic: "Catch-up: intro.pdf", baseline: 80, latest: 60, attempts: 2, delta: -20 },
    ]);
    expect(gains).toEqual([
      { courseId: "c1", document: "week5.pdf", before: 40, after: 80, gain: 40, attempts: 3 },
      { courseId: "c2", document: "intro.pdf", before: 80, after: 60, gain: -20, attempts: 2 },
    ]);
  });

  it("finds the single-attempt (pre-check only) state for one pack", () => {
    expect(catchupGains([{ courseId: "c1", topic: "Catch-up: week6.pdf", baseline: 60, latest: 60, attempts: 1, delta: 0 }], { includePending: true })).toEqual([
      { courseId: "c1", document: "week6.pdf", before: 60, after: null, gain: null, attempts: 1 },
    ]);
  });
});
