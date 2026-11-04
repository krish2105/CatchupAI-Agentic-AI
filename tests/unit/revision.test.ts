import { describe, expect, it } from "vitest";
import { revisionSchedule, topicProgress } from "@/lib/quiz/revision";

const day = 86400_000;
const T0 = Date.parse("2026-11-01T10:00:00Z");
const at = (d: number) => new Date(T0 + d * day).toISOString();

describe("revisionSchedule (FSRS)", () => {
  const ans = (term: string, correct: boolean, d: number) => ({ term, correct, at: at(d), courseId: "c" });
  const interval = (item: { lastSeen: string; dueAt: string }) => Math.round((Date.parse(item.dueAt) - Date.parse(item.lastSeen)) / day);

  it("brings a missed concept back the next day", () => {
    const [item] = revisionSchedule([ans("residual", false, 0)], T0);
    expect(item).toMatchObject({ term: "residual", misses: 1, attempts: 1, due: false, intervalDays: 1 });
    expect(item.dueAt).toBe(at(1));
  });

  it("spaces reviews further apart after each correct answer", () => {
    const history = [ans("residual", false, 0)];
    const intervals: number[] = [];
    for (let i = 0, d = 1; i < 4; i++) {
      history.push(ans("residual", true, d));
      const [item] = revisionSchedule(history, T0 + d * day);
      intervals.push(interval(item));
      d += interval(item);
    }
    expect(intervals.every((n, i) => i === 0 || n > intervals[i - 1])).toBe(true);
    expect(intervals[0]).toBeGreaterThanOrEqual(1);
  });

  it("shortens the gap again after a new miss and marks overdue items as due", () => {
    const before = revisionSchedule([ans("slope", false, 0), ans("slope", true, 1), ans("slope", true, 4)], T0 + 4 * day)[0];
    const after = revisionSchedule([ans("slope", false, 0), ans("slope", true, 1), ans("slope", true, 4), ans("slope", false, 4 + interval(before))], T0 + 40 * day)[0];
    expect(interval(after)).toBeLessThan(interval(before));
    expect(after).toMatchObject({ misses: 2, due: true });
  });

  it("reports memory stability, difficulty and today's recall probability", () => {
    const [item] = revisionSchedule([ans("slope", false, 0), ans("slope", true, 1)], T0 + 2 * day);
    expect(item.stability).toBeGreaterThan(0);
    expect(item.difficulty).toBeGreaterThanOrEqual(1);
    expect(item.difficulty).toBeLessThanOrEqual(10);
    expect(item.recall).toBeGreaterThan(0);
    expect(item.recall).toBeLessThanOrEqual(1);
  });

  it("is deterministic (no random fuzz) and keeps courses apart", () => {
    const answers = [ans("residual", false, 0), ans("residual", true, 1), { ...ans("residual", false, 0), courseId: "other" }];
    expect(revisionSchedule(answers, T0 + 3 * day)).toEqual(revisionSchedule(answers, T0 + 3 * day));
    expect(revisionSchedule(answers, T0 + 3 * day)).toHaveLength(2);
  });

  it("does not schedule concepts that were never missed", () => {
    expect(revisionSchedule([ans("intercept", true, 0)], T0)).toEqual([]);
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
