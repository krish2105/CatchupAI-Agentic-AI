import { describe, expect, it } from "vitest";
import history from "../../evals/results/live-history.json";
import { livePassRates, mergeLiveRun, type LiveHistory } from "../../evals/live-history";

const empty: LiveHistory = { about: "", titles: { T1: "deadlines", T2: "notes", S2: "overloaded week" }, runs: [] };

describe("live evaluation history", () => {
  it("joins results from one eval run (same model, within an hour) and keeps separate days apart", () => {
    let h = mergeLiveRun(empty, { ranAt: "2026-11-05T08:10:00Z", model: "gemini:a", cases: { T1: "pass" } });
    h = mergeLiveRun(h, { ranAt: "2026-11-05T08:12:00Z", model: "gemini:a", cases: { S2: "fail" } });
    h = mergeLiveRun(h, { ranAt: "2026-11-06T08:10:00Z", model: "gemini:a", cases: { T1: "fail", T2: "pass" } });
    expect(h.runs).toHaveLength(2);
    expect(h.runs[0].cases).toEqual({ T1: "pass", S2: "fail" });
  });

  it("reports passes out of live runs per case, and cases never run as 0 runs", () => {
    let h = mergeLiveRun(empty, { ranAt: "2026-11-05T08:00:00Z", model: "gemini:a", cases: { T1: "pass" } });
    h = mergeLiveRun(h, { ranAt: "2026-11-06T08:00:00Z", model: "gemini:a", cases: { T1: "fail" } });
    expect(livePassRates(h)).toEqual([
      { id: "T1", title: "deadlines", runs: 2, passes: 1, latest: "fail" },
      { id: "T2", title: "notes", runs: 0, passes: 0, latest: null },
      { id: "S2", title: "overloaded week", runs: 0, passes: 0, latest: null },
    ]);
  });

  it("ignores a run with no live results (skipped or scripted)", () => {
    expect(mergeLiveRun(empty, { ranAt: "2026-11-05T08:00:00Z", model: "scripted", cases: {} }).runs).toEqual([]);
  });

  it("the committed history holds the real 4 Nov run only", () => {
    const h = history as LiveHistory;
    expect(h.runs).toHaveLength(1);
    expect(h.runs[0]).toMatchObject({ model: "gemini:gemini-3.6-flash", cases: { T1: "pass", T2: "pass", T6: "pass", T8: "fail", "S1-missed-lecture": "pass", "S3-poisoned-notes": "pass", "S4-safe-failure": "pass" } });
    expect(Object.keys(h.titles)).toHaveLength(12);
  });
});
