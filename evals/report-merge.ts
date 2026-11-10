/**
 * Keeps the committed evaluation evidence (evals/REPORT.md, evals/results/latest.json, docs/evidence/agent-traces/SUMMARY.json)
 * honest when a live run covers only some cases (LIVE_CASES) or fails before any case runs.
 *
 * Found on 9 Nov: a run whose local database wasn't up rewrote all three files, and a partial run marked every
 * unselected live case "skipped", so /quality would have shown 31/38 instead of each case's latest real result.
 * Rules: a case that wasn't selected keeps its last real pass/fail (marked with where it came from); nothing is ever
 * invented (no earlier real result → still skipped); and if no case actually ran, nothing committed is written.
 */
export type CaseResult = {
  id: string;
  category: "retrieval" | "schedule" | "tool_selection" | "approval" | "security" | "robustness";
  name: string;
  status: "pass" | "fail" | "skipped";
  detail: string;
  ms: number;
};
export type ScenarioEntry = { id: string; title: string; status: "PASS" | "FAIL" | "SKIPPED"; reason?: string; carriedFrom?: string; [k: string]: unknown };

const NOT_SELECTED = /^not selected for this run/;
const FROM = " · from the run at ";

/** Current results, with each not-selected case replaced by its last real result from the previous report. */
export function mergeCaseResults(previous: CaseResult[] | undefined, current: CaseResult[], previousRanAt: string): CaseResult[] {
  const before = new Map((previous ?? []).map((r) => [r.id, r]));
  return current.map((r) => {
    const old = before.get(r.id);
    if (r.status !== "skipped" || !NOT_SELECTED.test(r.detail) || !old || old.status === "skipped") return r;
    return { ...old, detail: old.detail.includes(FROM) ? old.detail : `${old.detail}${FROM}${previousRanAt}` };
  });
}

/** Same rule for the agentic-scenario summary. */
export function mergeScenarioSummary(previous: ScenarioEntry[] | undefined, current: ScenarioEntry[], previousRanAt: string): ScenarioEntry[] {
  const before = new Map((previous ?? []).map((s) => [s.id, s]));
  return current.map((s) => {
    const old = before.get(s.id);
    if (s.status !== "SKIPPED" || !NOT_SELECTED.test(s.reason ?? "") || !old || old.status === "SKIPPED") return s;
    return { ...old, carriedFrom: old.carriedFrom ?? previousRanAt };
  });
}

/** Committed evidence is written only when at least one case really ran (passed or failed). */
export function shouldWriteEvidence(results: (CaseResult | ScenarioEntry)[]): boolean {
  return results.some((r) => r.status === "pass" || r.status === "fail" || r.status === "PASS" || r.status === "FAIL");
}
