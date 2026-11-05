/**
 * Live OCR check on a real image-only scan (tests/fixtures/scan_statistics_p1.pdf: page 1 of the synthetic statistics
 * module rendered to an image, no selectable text). One Gemini request. Live only: runs when OCR_LIVE=1 and a Gemini
 * key is set; otherwise skipped (reported as not run). Writes evals/results/ocr-latest.json.
 *   OCR_LIVE=1 npm run eval -- evals/ocr.eval.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { extractPdfPages, PdfError } from "@/lib/rag/pdf";
import { geminiOcr } from "@/lib/rag/ocr";

config({ path: ".env.local", quiet: true });
const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_OCR_MODEL?.trim() || process.env.GEMINI_MODEL?.trim();
const live = process.env.OCR_LIVE === "1" && Boolean(key && model);

// Phrases that are on the page (tests/fixtures/statistics_module_4.pdf, page 1).
const EXPECTED = ["Applied Statistics", "Module 4", "Simple linear regression", "predictor X", "outcome Y", "intercept", "slope", "one-unit increase", "not a guarantee"];

describe("live OCR", () => {
  it.skipIf(!live)("reads the scan's text with the configured Gemini model", async () => {
    const bytes = new Uint8Array(readFileSync("tests/fixtures/scan_statistics_p1.pdf"));
    const extracted = await extractPdfPages(bytes).then(() => null, (e: unknown) => e);
    expect(extracted).toBeInstanceOf(PdfError);
    expect((extracted as PdfError).code).toBe("no_text");
    const started = Date.now();
    const r = await geminiOcr({ apiKey: key!, model: model! }).read(bytes, (extracted as PdfError).pageCount ?? 1);
    const ms = Date.now() - started;
    const text = r.pages.join("\n").toLowerCase();
    const found = EXPECTED.filter((p) => text.includes(p.toLowerCase()));
    writeFileSync("evals/results/ocr-latest.json", `${JSON.stringify({ at: new Date().toISOString(), model, ms, usage: r.usage, pages: r.pages.length, chars: text.length, expected: EXPECTED.length, found: found.length, missing: EXPECTED.filter((p) => !found.includes(p)), text: r.pages }, null, 2)}\n`);
    expect(found.length).toBeGreaterThanOrEqual(EXPECTED.length - 1);
  });
});
