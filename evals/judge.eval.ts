/**
 * AI faithfulness judge vs the labelled claims (evals/rag/claims.json), beside the deterministic word check.
 * Live only: runs when JUDGE_LIVE=1 and a model key is configured; otherwise it is reported as "not run".
 *   JUDGE_LIVE=1 npm run eval -- evals/judge.eval.ts
 * Verdicts are cached in evals/results/judge-cache.json (keyed by model + claim + passage), so a rerun on the same
 * claims makes no requests. All 30 claims fit in one request. Writes evals/JUDGE_REPORT.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import claims from "./rag/claims.json";
import { claimSupport } from "@/lib/rag/claim-support";
import { judgeClaims, judgeClientFromEnv, VerdictCache } from "@/lib/rag/faithfulness-judge";

const CACHE = "evals/results/judge-cache.json";
const client = process.env.JUDGE_LIVE === "1" ? judgeClientFromEnv() : null;

describe("faithfulness judge (live)", () => {
  it.skipIf(!client)("agreement with the labels and with the word check", async () => {
    const passages = claims.passages as Record<string, string>;
    const cache = existsSync(CACHE) ? VerdictCache.fromJSON(JSON.parse(readFileSync(CACHE, "utf8"))) : new VerdictCache();
    const items = claims.claims.map((c) => ({ id: c.id, claim: c.claim, passages: [passages[c.passage]] }));
    const r = await judgeClaims(items, client!, cache, { timeoutMs: 60_000 });
    writeFileSync(CACHE, JSON.stringify(cache, null, 2));

    const rows = claims.claims.map((c) => {
      const word = claimSupport(c.claim, [passages[c.passage]]).supported;
      const v = r.verdicts.get(c.id);
      return { id: c.id, label: c.label, word, judge: v?.supported ?? null, reason: v?.reason ?? "no verdict", both: word && (v?.supported ?? true) };
    });
    const judged = rows.filter((x) => x.judge !== null);
    const agree = (pred: (x: (typeof rows)[number]) => boolean | null) => rows.filter((x) => pred(x) === x.label).length;
    const md = [
      "# Faithfulness judge evaluation (generated)",
      "",
      `Generated at ${new Date().toISOString()} by \`JUDGE_LIVE=1 npm run eval -- evals/judge.eval.ts\`. Judge model: ${client!.model}. ${claims.claims.length} labelled claims (labels by the developer).`,
      `Requests this run: ${r.calls} (cached verdicts: ${r.cached}, no verdict: ${r.failed}); tokens ${r.usage.inputTokens} in / ${r.usage.outputTokens} out.`,
      "",
      "| Check | Agrees with the label |",
      "| --- | --- |",
      `| Word check alone | ${agree((x) => x.word)}/${rows.length} |`,
      `| AI judge alone (claims with a verdict) | ${judged.filter((x) => x.judge === x.label).length}/${judged.length} |`,
      `| Word check, then judge (as in the copilot) | ${agree((x) => x.both)}/${rows.length} |`,
      `| Judge agrees with the word check | ${judged.filter((x) => x.judge === x.word).length}/${judged.length} |`,
      "",
      "| ID | Label | Word check | Judge | Judge's reason |",
      "| --- | --- | --- | --- | --- |",
      ...rows.map((x) => `| ${x.id} | ${x.label} | ${x.word} | ${x.judge ?? "—"} | ${x.reason.replace(/\|/g, "/")} |`),
      "",
    ].join("\n");
    writeFileSync("evals/JUDGE_REPORT.md", md);
    expect(judged.length).toBeGreaterThan(0);
  });
});
