/**
 * Live OCR check on a real image-only scan (tests/fixtures/scan_statistics_p1.pdf: page 1 of the synthetic statistics
 * module rendered to an image, no selectable text). One OpenAI request. Live only: runs when OCR_LIVE=1 and an OpenAI
 * key and model are set; otherwise skipped (reported as not run). Writes evals/results/ocr-latest.json.
 *   OCR_LIVE=1 npm run eval -- evals/ocr.eval.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { extractPdfPages, PdfError } from "@/lib/rag/pdf";
import { openAiOcr } from "@/lib/rag/ocr";

config({ path: ".env.local", quiet: true });
const key = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_OCR_MODEL?.trim() || process.env.OPENAI_MODEL?.trim();
const live = process.env.OCR_LIVE === "1" && Boolean(key && model);

// Phrases that are on the page (tests/fixtures/statistics_module_4.pdf, page 1).
/** Word-level edit distance / reference word count (word error rate). */
function wordErrorRate(reference: string, hypothesis: string) {
  const a = reference.split(/\s+/).filter(Boolean), b = hypothesis.split(/\s+/).filter(Boolean);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return { referenceWords: a.length, edits: prev[b.length], wer: Math.round((prev[b.length] / Math.max(1, a.length)) * 1000) / 1000 };
}

const EXPECTED = ["Applied Statistics", "Module 4", "Simple linear regression", "predictor X", "outcome Y", "intercept", "slope", "one-unit increase", "not a guarantee"];

describe("live OCR", () => {
  it.skipIf(!live)("reads the scan's text with the configured OpenAI model", async () => {
    const bytes = new Uint8Array(readFileSync("tests/fixtures/scan_statistics_p1.pdf"));
    const extracted = await extractPdfPages(bytes).then(() => null, (e: unknown) => e);
    expect(extracted).toBeInstanceOf(PdfError);
    expect((extracted as PdfError).code).toBe("no_text");
    const started = Date.now();
    const r = await openAiOcr({ apiKey: key!, model: model! }).read(bytes, (extracted as PdfError).pageCount ?? 1);
    const ms = Date.now() - started;
    const text = r.pages.join("\n").toLowerCase();
    // Reference: the same page's real text layer in the original (text) PDF.
    const original = (await extractPdfPages(new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"))))[0];
    const accuracy = wordErrorRate(original.replace(/\s+/g, " "), r.pages[0].replace(/\s+/g, " "));
    const found = EXPECTED.filter((p) => text.includes(p.toLowerCase()));
    writeFileSync("evals/results/ocr-latest.json", `${JSON.stringify({ at: new Date().toISOString(), model, ms, usage: r.usage, pages: r.pages.length, chars: text.length, expected: EXPECTED.length, found: found.length, accuracy, missing: EXPECTED.filter((p) => !found.includes(p)), text: r.pages }, null, 2)}\n`);
    expect(found.length).toBeGreaterThanOrEqual(EXPECTED.length - 1);
  });
});
