import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPack } from "@/lib/catchup/pack";
import type { Passage } from "@/lib/quiz/cloze";

const notes = readFileSync("data/statistics_module_4_synthetic_notes.txt", "utf8");
const passages: Passage[] = notes.split(/\n(?=PAGE \d)/).slice(1).map((block, i) => ({ chunkId: `c${i}`, documentId: "doc", filename: "module4.pdf", page: i + 1, content: block }));

describe("missed lecture catch-up pack", () => {
  const pack = buildPack(passages, "seed-1");

  it("summarises across pages in page order, using only sentences from the lecture", () => {
    expect(pack.summary.length).toBeGreaterThanOrEqual(4);
    expect(new Set(pack.summary.map((s) => s.page)).size).toBeGreaterThanOrEqual(3);
    expect(pack.summary.map((s) => s.page)).toEqual([...pack.summary.map((s) => s.page)].sort((a, b) => a - b));
    for (const s of pack.summary) expect(notes.replace(/\s+/g, " ")).toContain(s.text.slice(0, 50));
  });

  it("lists key terms with a quote and page, and self-check questions whose answer is an option", () => {
    expect(pack.keyTerms.length).toBeGreaterThanOrEqual(5);
    expect(pack.keyTerms.map((t) => t.term)).toContain("residual");
    for (const t of pack.keyTerms) expect(t.quote.toLowerCase()).toContain(t.term.slice(0, 5).toLowerCase());
    expect(pack.questions.length).toBeGreaterThanOrEqual(3);
    for (const q of pack.questions) expect(q.options).toContain(q.answer);
  });

  it("plans about 30 minutes and is deterministic for the same seed", () => {
    expect(pack.plan.reduce((s, b) => s + b.minutes, 0)).toBeGreaterThanOrEqual(25);
    expect(buildPack(passages, "seed-1")).toEqual(pack);
  });
});
