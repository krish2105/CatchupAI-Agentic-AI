import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunkPages } from "@/lib/rag/chunk";
import { extractPdfPages, PdfError } from "@/lib/rag/pdf";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (e) {
    return e instanceof PdfError ? e.code : `unexpected:${String(e)}`;
  }
}

describe("extractPdfPages", () => {
  it("extracts text per page from a text PDF", async () => {
    const pages = await extractPdfPages(fixture("statistics_module_4.pdf"));
    expect(pages).toHaveLength(4);
    expect(pages[1]).toMatch(/residual equals observed Y minus predicted/i);
    expect(pages[3]).toMatch(/PRACTICE TASK/);
  });

  it("rejects non-PDF bytes, empty files, scanned (no text) and oversized page counts", async () => {
    expect(await code(extractPdfPages(new TextEncoder().encode("<html>not a pdf</html>")))).toBe("not_pdf");
    expect(await code(extractPdfPages(new Uint8Array()))).toBe("empty");
    expect(await code(extractPdfPages(fixture("no_text.pdf")))).toBe("no_text");
    expect(await code(extractPdfPages(fixture("too_many_pages.pdf")))).toBe("too_many_pages");
  });

  it("rejects a truncated PDF as malformed", async () => {
    const bytes = fixture("statistics_module_4.pdf").subarray(0, 400);
    expect(await code(extractPdfPages(bytes))).toBe("malformed");
  });

  it("rejects files over 10 MB before parsing", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(new TextEncoder().encode("%PDF-1.7"));
    expect(await code(extractPdfPages(big))).toBe("too_large");
  });
});

describe("chunkPages", () => {
  it("never crosses page boundaries and preserves page numbers", () => {
    const chunks = chunkPages(["alpha beta.", "", "gamma delta."]);
    expect(chunks).toEqual([
      { chunkIndex: 0, pageStart: 1, pageEnd: 1, content: "alpha beta." },
      { chunkIndex: 1, pageStart: 3, pageEnd: 3, content: "gamma delta." },
    ]);
  });

  it("splits long pages into overlapping windows within the size limit", () => {
    const sentence = "Regression models relate a predictor to an outcome. ";
    const chunks = chunkPages([sentence.repeat(120)], { maxChars: 600, overlapChars: 100 });
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.content.length <= 600 && c.pageStart === 1)).toBe(true);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    // Overlap: the start of each chunk appears near the end of the previous one.
    expect(chunks[0].content.slice(-100)).toContain(chunks[1].content.slice(0, 20));
  });
});
