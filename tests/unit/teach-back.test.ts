import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Passage } from "@/lib/quiz/cloze";
import { analyseExplanation, stem } from "@/lib/teach/feedback";

// The synthetic module notes, split into one passage per page (as ingestion does).
const notes = readFileSync("data/statistics_module_4_synthetic_notes.txt", "utf8");
const passages: Passage[] = notes
  .split(/\n(?=PAGE \d)/)
  .slice(1)
  .map((block, i) => ({ chunkId: `c${i + 1}`, documentId: "doc-1", filename: "statistics_module_4.pdf", page: i + 1, content: block }));

describe("teach-it-back feedback", () => {
  it("stems plurals and common endings", () => {
    expect(stem("residuals")).toBe(stem("residual"));
    expect(stem("assumptions")).toBe(stem("assumption"));
    expect(stem("Predicted")).toBe(stem("predict"));
  });

  it("credits concepts the student explained and cites every concept to a real page", () => {
    const strong =
      "A residual is the observed value minus the predicted value from the regression line. Least squares picks the intercept and slope " +
      "that minimise the squared residuals. Large residuals show a poor fit for that observation, and a residual plot can reveal nonlinear patterns. " +
      "The intercept is the prediction when X is zero and the slope is the change in the outcome per unit of the predictor.";
    const feedback = analyseExplanation(strong, passages, "residuals");
    expect(feedback.concepts.length).toBeGreaterThanOrEqual(4);
    expect(feedback.concepts.every((c) => c.citation.page >= 1 && c.citation.page <= 4 && c.citation.filename === "statistics_module_4.pdf")).toBe(true);
    // The topic word itself is never counted as a concept to "cover".
    expect(feedback.concepts.map((c) => stem(c.term))).not.toContain(stem("residuals"));
    expect(feedback.coveragePercent).toBeGreaterThanOrEqual(50);
  });

  it("flags missing concepts with a quote from the notes, and short answers stay at 'starting'", () => {
    const weak = "Residuals are errors.";
    const feedback = analyseExplanation(weak, passages, "residuals");
    expect(feedback.level).toBe("starting");
    expect(feedback.missingTerms.length).toBeGreaterThan(0);
    const missing = feedback.concepts.find((c) => !c.covered)!;
    expect(missing.quote).toBeTruthy();
    expect(notes).toContain(missing.quote!.slice(0, 40));
  });

  it("returns no concepts (and 0%) when there is no evidence", () => {
    const feedback = analyseExplanation("Photosynthesis turns light into chemical energy in plants over many steps.", [], "photosynthesis");
    expect(feedback.concepts).toEqual([]);
    expect(feedback.coveragePercent).toBe(0);
  });
});
