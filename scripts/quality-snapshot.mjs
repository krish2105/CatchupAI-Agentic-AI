#!/usr/bin/env node
/**
 * Writes src/lib/quality/snapshot.json for the public /quality page: test cases defined in the repo, the
 * latest committed evaluation results, and security facts read from the migrations. Runs before every
 * build, so the deployed page describes the deployed code. Counts only; no timestamps (stable diffs).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const files = (dir, ext) => readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(ext)).map((f) => join(dir, f));
// test("…") / it("…") definitions (not test.describe/test.setTimeout). Loops that generate tests count once.
const countTests = (dir, ext) => files(dir, ext).reduce((n, f) => n + (readFileSync(f, "utf8").match(/(?:^|[\s;{(])(?:it|test)(?:\.(?:only|skip))?\(\s*[`"']/g)?.length ?? 0), 0);

const migrations = files("supabase/migrations", ".sql");
const sql = migrations.map((f) => readFileSync(f, "utf8")).join("\n");
const evals = JSON.parse(readFileSync("evals/results/latest.json", "utf8"));
const limits = readFileSync("src/lib/http/rate-limit.ts", "utf8");
// Live-model runs over time (evals/live-history.ts writes it; same counting as livePassRates there).
const history = JSON.parse(readFileSync("evals/results/live-history.json", "utf8"));
const liveCases = Object.entries(history.titles).map(([id, title]) => {
  const results = history.runs.filter((r) => r.cases[id]).map((r) => r.cases[id]);
  return { id, title, runs: results.length, passes: results.filter((s) => s === "pass").length, latest: results.at(-1) ?? null };
});

const snapshot = {
  tests: {
    unit: countTests("tests/unit", ".test.ts"),
    integration: countTests("tests/integration", ".test.ts"),
    e2e: countTests("tests/e2e", ".spec.ts"),
  },
  eval: {
    ranAt: evals.meta.ranAt,
    retrievalMode: evals.meta.retrievalMode,
    agentModel: evals.meta.agentModel,
    totals: evals.meta.totals,
    categories: evals.summary.map(({ category, total, pass, fail, skipped }) => ({ category, total, pass, fail, skipped })),
  },
  live: {
    runs: history.runs.length,
    models: [...new Set(history.runs.map((r) => r.model))],
    lastRanAt: history.runs.at(-1)?.ranAt ?? null,
    cases: liveCases,
  },
  security: {
    migrations: migrations.length,
    tablesWithRls: new Set([...sql.matchAll(/alter table (public\.\w+) enable row level security/g)].map((m) => m[1])).size,
    rateLimitBuckets: (limits.match(/bucket: "/g) ?? []).length,
    securityDefinerFunctions: (sql.match(/security definer/gi) ?? []).length,
  },
};
writeFileSync("src/lib/quality/snapshot.json", JSON.stringify(snapshot, null, 2) + "\n");
console.log(`quality snapshot: ${snapshot.tests.unit} unit, ${snapshot.tests.integration} integration, ${snapshot.tests.e2e} e2e tests; ${snapshot.security.tablesWithRls} RLS tables`);
