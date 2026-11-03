import { describe, expect, it } from "vitest";
import { revisionSchedule, topicProgress } from "@/lib/quiz/revision";

const day = 86400_000;
const T0 = Date.parse("2026-11-01T10:00:00Z");
const at = (d: number) => new Date(T0 + d * day).toISOString();

describe("revisionSchedule", () => {
  it("schedules a missed concept for tomorrow and promotes it on later correct answers", () => {
    const answers = [
      { term: "residual", correct: false, at: at(0), courseId: "c" },
      { term: "residual", correct: true, at: at(1), courseId: "c" },
      { term: "residual", correct: true, at: at(4), courseId: "c" },
    ];
    const [item] = revisionSchedule(answers, T0 + 5 * day);
    expect(item).toMatchObject({ term: "residual", box: 2, misses: 1, attempts: 3, due: false });
    expect(item.dueAt).toBe(at(4 + 7));
  });

  it("resets to one day after a new miss and marks overdue items as due", () => {
    const [item] = revisionSchedule(
      [
        { term: "slope", correct: false, at: at(0), courseId: "c" },
        { term: "slope", correct: true, at: at(1), courseId: "c" },
        { term: "slope", correct: false, at: at(2), courseId: "c" },
      ],
      T0 + 4 * day,
    );
    expect(item).toMatchObject({ box: 0, due: true, dueAt: at(3) });
  });

  it("does not schedule concepts that were never missed", () => {
    expect(revisionSchedule([{ term: "intercept", correct: true, at: at(0), courseId: "c" }], T0)).toEqual([]);
  });
});

describe("topicProgress", () => {
  it("compares the first attempt with the latest per topic", () => {
    const p = topicProgress([
      { courseId: "c", topic: "Whole course", score: 40, at: at(0) },
      { courseId: "c", topic: "Whole course", score: 60, at: at(1) },
      { courseId: "c", topic: "Whole course", score: 80, at: at(2) },
      { courseId: "c", topic: "residuals", score: 100, at: at(1) },
    ]);
    expect(p.find((x) => x.topic === "Whole course")).toMatchObject({ baseline: 40, latest: 80, attempts: 3, delta: 40 });
    expect(p.find((x) => x.topic === "residuals")).toMatchObject({ baseline: 100, latest: 100, delta: 0, attempts: 1 });
  });
});
