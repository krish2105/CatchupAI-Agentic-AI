import { describe, expect, it } from "vitest";
import { criteriaWeightTotal, extractRubric } from "@/lib/rubric/extract";

// Two pages as text extraction returns them: headings, PDF-wrapped lines, mixed sentences.
const PAGES = [
  `Assignment 2 · Regression analysis report
Due 14 November 2026 at 17:00. Submit a 1,500 to 2,000 word report as a PDF through the course
portal. You must include a scatter plot with a fitted regression line. Use APA 7 referencing with at
least five academic sources. Late submissions lose 5% of the available marks per day.`,
  `Marking rubric
Analysis and interpretation (40%): correct model equation and a plain-language interpretation of the
slope and intercept.
Use of evidence (25%): residual plot discussed and assumptions checked.
Communication (20%): clear structure and labelled figures.
Referencing (15%): consistent APA 7 style.
Deliverables: the report PDF and the code used for the analysis.`,
];

describe("rubric decoder", () => {
  const items = extractRubric(PAGES);

  it("finds every weighted criterion with its weight and page", () => {
    const criteria = items.filter((i) => i.kind === "criterion");
    expect(criteria.map((c) => [c.weight, c.page])).toEqual([[40, 2], [25, 2], [20, 2], [15, 2]]);
    expect(criteria[0].text).toBe("Analysis and interpretation: correct model equation and a plain-language interpretation of the slope and intercept");
    expect(criteriaWeightTotal(items)).toBe(100);
  });

  it("separates the deadline, deliverables and requirements, re-joining wrapped lines", () => {
    expect(items.find((i) => i.kind === "deadline")?.text).toBe("Due 14 November 2026 at 17:00");
    const deliverables = items.filter((i) => i.kind === "deliverable").map((i) => i.text);
    expect(deliverables).toContain("Submit a 1,500 to 2,000 word report as a PDF through the course portal");
    expect(deliverables).toContain("Deliverables: the report PDF and the code used for the analysis");
    const requirements = items.filter((i) => i.kind === "requirement").map((i) => i.text);
    expect(requirements).toContain("You must include a scatter plot with a fitted regression line");
    expect(requirements).toContain("Use APA 7 referencing with at least five academic sources");
    expect(requirements.some((r) => r.startsWith("Late submissions lose 5%"))).toBe(true);
  });

  it("does not turn headings or a late-penalty percentage into criteria", () => {
    expect(items.some((i) => /^Marking rubric|^Assignment 2/.test(i.text))).toBe(false);
    expect(items.filter((i) => i.kind === "criterion").every((c) => !/late/i.test(c.text))).toBe(true);
  });

  it("returns nothing for text with no brief content", () => {
    expect(extractRubric(["Photosynthesis converts light into chemical energy in plants."])).toEqual([]);
    expect(criteriaWeightTotal([])).toBeNull();
  });
});

describe("rubric decoder on the real brief PDF (same path as the API: extract → chunk → per-page text)", () => {
  it("recovers the criteria, deadline, deliverables and requirements", async () => {
    const { readFileSync } = await import("node:fs");
    const { extractPdfPages } = await import("@/lib/rag/pdf");
    const { chunkPages } = await import("@/lib/rag/chunk");
    const chunks = chunkPages(await extractPdfPages(new Uint8Array(readFileSync("tests/fixtures/assignment_brief.pdf"))));
    const pages: string[] = [];
    for (const c of chunks) pages[c.pageStart - 1] = `${pages[c.pageStart - 1] ?? ""}\n${c.content}`;
    const items = extractRubric(Array.from(pages, (p) => p ?? ""));
    const summary = items.map((i) => `${i.kind}${i.weight ? `(${i.weight})` : ""}@${i.page}`);
    expect(summary.filter((s) => s.startsWith("criterion"))).toEqual(["criterion(40)@2", "criterion(25)@2", "criterion(20)@2", "criterion(15)@2"]);
    expect(summary).toContain("deadline@1");
    expect(items.filter((i) => i.kind === "deliverable")).toHaveLength(2);
    expect(items.filter((i) => i.kind === "requirement").length).toBeGreaterThanOrEqual(3);
  });
});
