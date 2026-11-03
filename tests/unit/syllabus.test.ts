import { describe, expect, it } from "vitest";
import { extractSyllabusDeadlines } from "@/lib/syllabus/extract";

const NOW = Date.parse("2026-11-03T08:00:00Z");
const pages = [
  [
    "Applied Statistics — Syllabus (Fall 2026)",
    "Week 3 · Lecture: Sampling distributions (Nov 5)",
    "Quiz 1: Regression basics — due 12 Nov 2026, 16:00",
    "Assignment 2 (Regression worksheet) due 2026-11-20 23:59",
  ].join("\n"),
  ["Midterm exam: 27/11/2026 10:00", "Final project report due December 11", "Office hours every Tuesday 3pm"].join("\n"),
];

describe("extractSyllabusDeadlines", () => {
  const found = extractSyllabusDeadlines(pages, { timezone: "Asia/Dubai", now: NOW });

  it("finds graded work with dates and ignores lectures and office hours", () => {
    expect(found.map((f) => f.title)).toEqual([
      "Quiz 1: Regression basics",
      "Assignment 2 (Regression worksheet)",
      "Midterm exam",
      "Final project report",
    ]);
  });

  it("converts local times in the student's zone and records assumptions", () => {
    expect(found[0]).toMatchObject({ dueAt: "2026-11-12T12:00:00.000Z", page: 1, estimatedMinutes: 90, assumptions: [] });
    expect(found[2]).toMatchObject({ dueAt: "2026-11-27T06:00:00.000Z", page: 2, estimatedMinutes: 360 });
    expect(found[2].assumptions).toEqual([]); // 27/11 is unambiguous
    const [ambiguous] = extractSyllabusDeadlines(["Quiz 2 due 05/12/2026 09:00"], { timezone: "UTC", now: NOW });
    expect(ambiguous).toMatchObject({ dueAt: "2026-12-05T09:00:00.000Z", assumptions: ["Read as day/month"] });
    expect(found[3].assumptions).toEqual(expect.arrayContaining(["Year assumed 2026", "No time given: 23:59 assumed"]));
    expect(found[3].dueAt).toBe("2026-12-11T19:59:00.000Z");
  });

  it("rejects impossible dates and returns nothing for text without deadlines", () => {
    expect(extractSyllabusDeadlines(["Assignment due 31 Nov 2026"], { timezone: "UTC", now: NOW })).toEqual([]);
    expect(extractSyllabusDeadlines(["Welcome to the course. Readings are listed weekly."], { timezone: "UTC", now: NOW })).toEqual([]);
  });

  it("rolls a year-less past date into next year", () => {
    const [c] = extractSyllabusDeadlines(["Essay due 15 Jan"], { timezone: "UTC", now: NOW });
    expect(c.dueAt).toBe("2027-01-15T23:59:00.000Z");
  });
});

describe("syllabus PDF fixture", () => {
  it("extracts the same deadlines from real PDF text (wrapped lines)", async () => {
    const { readFileSync } = await import("node:fs");
    const { extractPdfPages } = await import("@/lib/rag/pdf");
    const { chunkPages } = await import("@/lib/rag/chunk");
    const pdfPages = await extractPdfPages(new Uint8Array(readFileSync("tests/fixtures/syllabus.pdf")));
    // Rebuild page text the way the extract API does (from stored chunks).
    const fromChunks: string[] = [];
    for (const c of chunkPages(pdfPages)) fromChunks[c.pageStart - 1] = `${fromChunks[c.pageStart - 1] ?? ""}\n${c.content}`;
    const found = extractSyllabusDeadlines(fromChunks, { timezone: "Asia/Dubai", now: NOW });
    if (process.env.SHOW) console.log(JSON.stringify(pdfPages), found);
    expect(found.map((f) => f.title)).toEqual(["Quiz 1: Regression basics", "Assignment 2 (Regression worksheet)", "Midterm exam", "Final project report"]);
  });
});
