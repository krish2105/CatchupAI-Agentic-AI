import { describe, expect, it } from "vitest";
import { mergeCaseResults, mergeScenarioSummary, shouldWriteEvidence, type CaseResult, type ScenarioEntry } from "../../evals/report-merge";

const NOT_SELECTED = "not selected for this run (LIVE_CASES quota budget)";
const prevAt = "2026-11-05T08:17:59.882Z";

const r = (id: string, status: CaseResult["status"], detail = "ok", category: CaseResult["category"] = "tool_selection"): CaseResult => ({ id, category, name: id, status, detail, ms: 10 });

describe("eval report merge (9 Nov bug: partial or failed live runs rewrote the committed reports)", () => {
  it("keeps the latest real result for a live case that wasn't selected this time, and says where it came from", () => {
    const previous = [r("T1", "pass", "used: list_assignments"), r("T2", "fail", "wrong tool")];
    const current = [r("T1", "skipped", NOT_SELECTED), r("T2", "pass", "used: search_course_material")];
    const merged = mergeCaseResults(previous, current, prevAt);
    expect(merged.map((x) => [x.id, x.status])).toEqual([["T1", "pass"], ["T2", "pass"]]);
    expect(merged[0].detail).toBe(`used: list_assignments · from the run at ${prevAt}`);
    expect(merged[1].detail).toBe("used: search_course_material");
  });

  it("doesn't stack the 'from the run at' note when a carried result is carried again", () => {
    const previous = [r("T1", "pass", `used: list_assignments · from the run at ${prevAt}`)];
    const merged = mergeCaseResults(previous, [r("T1", "skipped", NOT_SELECTED)], "2026-11-09T11:15:26.861Z");
    expect(merged[0].detail).toBe(`used: list_assignments · from the run at ${prevAt}`);
  });

  it("never invents a result: a case skipped for another reason, or with no earlier real result, stays skipped", () => {
    const previous = [r("T1", "skipped", "live model not requested"), r("R1", "pass", "p.2", "retrieval")];
    const current = [r("T1", "skipped", NOT_SELECTED), r("T3", "skipped", NOT_SELECTED), r("R1", "skipped", "something else", "retrieval")];
    const merged = mergeCaseResults(previous, current, prevAt);
    expect(merged.map((x) => x.status)).toEqual(["skipped", "skipped", "skipped"]);
  });

  it("does the same for the scenario summary (SUMMARY.json)", () => {
    const previous: ScenarioEntry[] = [
      { id: "S1-missed-lecture", title: "S1", status: "PASS", ms: 10700 },
      { id: "S2-overloaded-week", title: "S2", status: "FAIL", ms: 11454 },
    ];
    const current: ScenarioEntry[] = [
      { id: "S1-missed-lecture", title: "S1", status: "SKIPPED", reason: NOT_SELECTED },
      { id: "S2-overloaded-week", title: "S2", status: "PASS", ms: 39460 },
    ];
    const merged = mergeScenarioSummary(previous, current, prevAt);
    expect(merged).toEqual([
      { id: "S1-missed-lecture", title: "S1", status: "PASS", ms: 10700, carriedFrom: prevAt },
      { id: "S2-overloaded-week", title: "S2", status: "PASS", ms: 39460 },
    ]);
  });

  it("writes committed evidence only when at least one case actually ran (setup failures write nothing)", () => {
    expect(shouldWriteEvidence([])).toBe(false);
    expect(shouldWriteEvidence([r("T1", "skipped", NOT_SELECTED)])).toBe(false);
    expect(shouldWriteEvidence([r("T1", "fail", "boom")])).toBe(true);
    expect(shouldWriteEvidence([{ id: "S1", title: "S1", status: "SKIPPED", reason: NOT_SELECTED }])).toBe(false);
    expect(shouldWriteEvidence([{ id: "S1", title: "S1", status: "PASS" }])).toBe(true);
  });
});
