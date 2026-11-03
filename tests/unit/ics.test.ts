import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/calendar/ics";

describe("ics writer", () => {
  const ics = buildIcs(
    [{ uid: "task-1@catchup.ai", start: "2026-11-05T16:00:00.000Z", end: "2026-11-05T17:30:00.000Z", title: "Review p. 2; residuals, worked example", description: "Line one\nLine two" }],
    { name: "CatchUp AI study plan", now: Date.parse("2026-11-04T10:00:00Z") },
  );

  it("emits a valid calendar with UTC times and CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261105T160000Z\r\n");
    expect(ics).toContain("DTEND:20261105T173000Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("escapes text so titles can't inject calendar properties", () => {
    expect(escapeText("a;b,c\\d\nEND:VEVENT")).toBe("a\;b\\,c\\\\d\\nEND:VEVENT");
    expect(ics).toContain("SUMMARY:Review p. 2\; residuals\\, worked example");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});
