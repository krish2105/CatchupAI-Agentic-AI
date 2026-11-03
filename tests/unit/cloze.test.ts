import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateClozeQuiz, gradeQuiz, type Passage } from "@/lib/quiz/cloze";
import { extractPdfPages } from "@/lib/rag/pdf";

async function passages(): Promise<Passage[]> {
  const pages = await extractPdfPages(new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf")));
  return pages.map((content, i) => ({ chunkId: `c${i}`, documentId: "doc-1", filename: "module4.pdf", page: i + 1, content }));
}

describe("generateClozeQuiz", () => {
  it("builds grounded questions whose blanked term appears in the cited page", async () => {
    const source = await passages();
    const { questions, keys } = generateClozeQuiz(source, { seed: "quiz-1" });
    if (process.env.SHOW_QUIZ) console.log(JSON.stringify(questions.map((q, i) => ({ prompt: q.prompt, options: q.options, answer: q.options[keys[i].correctIndex], page: q.evidence.page })), null, 2));
    expect(questions.length).toBeGreaterThanOrEqual(4);
    for (const [i, q] of questions.entries()) {
      expect(q.prompt).toContain("_____");
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      const answer = q.options[keys[i].correctIndex];
      expect(answer).toBe(q.term);
      const page = source.find((p) => p.page === q.evidence.page)!;
      expect(page.content.toLowerCase()).toContain(answer);
      expect(page.content.replace(/\s+/g, " ")).toContain(keys[i].explanation);
    }
    expect(new Set(questions.map((q) => q.evidence.page)).size).toBeGreaterThan(1);
  });

  it("is deterministic for a seed and varies across seeds", async () => {
    const source = await passages();
    expect(generateClozeQuiz(source, { seed: "a" })).toEqual(generateClozeQuiz(source, { seed: "a" }));
    expect(JSON.stringify(generateClozeQuiz(source, { seed: "a" }).questions)).not.toBe(JSON.stringify(generateClozeQuiz(source, { seed: "b" }).questions));
  });

  it("returns nothing for material without usable sentences", () => {
    expect(generateClozeQuiz([{ chunkId: "x", documentId: "d", filename: "f", page: 1, content: "Short. Tiny." }], { seed: "s" }).questions).toEqual([]);
  });
});

describe("gradeQuiz", () => {
  it("scores answers and reports weak terms", async () => {
    const { questions, keys } = generateClozeQuiz(await passages(), { seed: "grade" });
    const answers = keys.map((k, i) => (i === 0 ? (k.correctIndex + 1) % 4 : k.correctIndex));
    const graded = gradeQuiz(questions, keys, answers);
    expect(graded.results[0].correct).toBe(false);
    expect(graded.weakTerms).toEqual([questions[0].term]);
    expect(graded.scorePercent).toBe(Math.round(((questions.length - 1) / questions.length) * 10000) / 100);
  });
});
