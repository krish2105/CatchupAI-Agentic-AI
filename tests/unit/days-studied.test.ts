import { describe, expect, it } from "vitest";
import { daysStudied } from "@/lib/insights/days-studied";

const days = (pattern: string) => [...pattern].map((c, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, minutes: c === "x" ? 30 : 0, blocks: c === "x" ? 1 : 0 }));

describe("days studied in the last 7", () => {
  it("counts days with a completed block over the last seven only", () => {
    const r = daysStudied(days("xxxxxxx" + "x.x.x.."));
    expect(r.days).toHaveLength(7);
    expect(r.days[0].date).toBe("2026-11-08");
    expect(r.studied).toBe(3);
    expect(r.summary).toBe("Studied on 3 of the last 7 days. The aim is 5; 2 rest days a week are part of the plan.");
  });

  it("treats rest days as planned, not failures", () => {
    const r = daysStudied(days("xx.xx.x"));
    expect(r).toMatchObject({ studied: 5, aim: 5, restDays: 2, restLeft: 0 });
    expect(r.summary).toContain("meets the aim of 5");
    expect(daysStudied(days("xxxxxx.")).restLeft).toBe(1);
  });

  it("has no notion of a run of consecutive days", () => {
    const spread = daysStudied(days("x.x.x.x.x".slice(0, 7)));
    const together = daysStudied(days("xxxx..."));
    expect(spread.studied).toBe(together.studied);
    expect(Object.keys(spread)).not.toContain("streak");
  });
});
