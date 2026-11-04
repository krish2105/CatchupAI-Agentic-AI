/**
 * History of live-model evaluation runs (evals/results/live-history.json), so the public /quality page can show a
 * pass rate per live case across days instead of one run. Only real live runs are recorded: cases that were
 * skipped or not selected are left out, and scripted runs are never written here.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type LiveStatus = "pass" | "fail";
export type LiveRun = { ranAt: string; model: string; cases: Record<string, LiveStatus> };
export type LiveHistory = { about: string; titles: Record<string, string>; runs: LiveRun[] };

export const LIVE_HISTORY = "evals/results/live-history.json";
const SAME_RUN_MS = 60 * 60_000;

/** Adds a run; results from the same model within an hour (one `npm run eval` writes twice) join the same run. */
export function mergeLiveRun(history: LiveHistory, run: LiveRun, titles: Record<string, string> = {}): LiveHistory {
  if (Object.keys(run.cases).length === 0) return history;
  const runs = [...history.runs];
  const i = runs.findIndex((r) => r.model === run.model && Math.abs(Date.parse(r.ranAt) - Date.parse(run.ranAt)) < SAME_RUN_MS);
  if (i >= 0) runs[i] = { ...runs[i], cases: { ...runs[i].cases, ...run.cases } };
  else runs.push(run);
  runs.sort((a, b) => a.ranAt.localeCompare(b.ranAt));
  return { ...history, titles: { ...history.titles, ...titles }, runs };
}

/** Per case: live runs, passes and the latest result. */
export function livePassRates(history: LiveHistory) {
  const ids = Object.keys(history.titles);
  return ids.map((id) => {
    const results = history.runs.filter((r) => r.cases[id]).map((r) => r.cases[id]);
    return { id, title: history.titles[id], runs: results.length, passes: results.filter((s) => s === "pass").length, latest: results.at(-1) ?? null };
  });
}

export function recordLiveRun(run: LiveRun, titles: Record<string, string>, path = LIVE_HISTORY) {
  const history: LiveHistory = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { about: "", titles: {}, runs: [] };
  writeFileSync(path, JSON.stringify(mergeLiveRun(history, run, titles), null, 2) + "\n");
}
