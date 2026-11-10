import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HISTORY_LIMITS } from "@/lib/agents/history";
import { toolFactSupport } from "@/lib/agents/tool-fact-support";
import { APP_GUIDE, findGuideSections, guideToolResult } from "@/lib/help/app-guide";
import { FRIDAY_PRAYER_WINDOW, IFTAR_BREAK, PRAYER_BREAK, RAMADAN_REDUCTION, UAE_CITY_KEYS } from "@/lib/planner/calendar-options";
import { PDF_LIMITS } from "@/lib/rag/pdf";

const section = (id: string) => APP_GUIDE.find((s) => s.id === id)!;
const ids = (question: string) => findGuideSections(question).map((s) => s.id);

describe("CatchUp app guide (what the copilot may say about the app)", () => {
  it("has unique sections, each with a title, a place in the app and text", () => {
    expect(new Set(APP_GUIDE.map((s) => s.id)).size).toBe(APP_GUIDE.length);
    for (const s of APP_GUIDE) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.where.length).toBeGreaterThan(3);
      expect(s.text.length).toBeGreaterThan(80);
      expect(s.text.length).toBeLessThan(1200);
    }
  });

  it("points only to pages that exist, so a moved page fails this test", () => {
    for (const s of APP_GUIDE) {
      for (const path of s.where.match(/\/[a-z][a-z-]*/g) ?? []) {
        const page = [`src/app/(app)${path}/page.tsx`, `src/app${path}/page.tsx`].some((f) => existsSync(f));
        expect(page, `${s.id}: ${path}`).toBe(true);
      }
    }
  });

  it("states the numbers the code uses", () => {
    expect(section("recovery-lab").text).toContain("Deadline first");
    expect(section("recovery-lab").text).toContain("Balanced recovery");
    expect(section("recovery-lab").text).toContain("Full recovery");
    expect(section("courses").text).toContain(`${PDF_LIMITS.maxBytes / 1024 / 1024} MB`);
    expect(section("courses").text).toContain(`${PDF_LIMITS.maxPages} pages`);
    expect(section("copilot").text).toContain(`last ${HISTORY_LIMITS.turns} turns`);
    const local = section("local-calendar").text;
    expect(local).toContain(`${String(FRIDAY_PRAYER_WINDOW.start[0]).padStart(2, "0")}:00`);
    expect(local).toContain(`${String(FRIDAY_PRAYER_WINDOW.end[0]).padStart(2, "0")}:00`);
    expect(local).toContain(`${PRAYER_BREAK.beforeMinutes + PRAYER_BREAK.afterMinutes} minutes`);
    expect(local).toContain(`${UAE_CITY_KEYS.length} UAE cities`);
    expect(local).toContain(`${RAMADAN_REDUCTION.default}%`);
    expect(local).toContain(`${IFTAR_BREAK.afterMinutes} minutes after`);
  });

  it("finds the right section for common questions", () => {
    expect(ids("How do I approve a plan?")[0]).toBe("approval");
    expect(ids("How do I turn on Ramadan mode?")[0]).toBe("local-calendar");
    expect(ids("Where do I upload my lecture PDFs?")[0]).toBe("courses");
    expect(ids("I missed a lecture, what is the catch-up pack?")[0]).toBe("catch-up");
    expect(ids("What is the difference between the routes?")[0]).toBe("recovery-lab");
    expect(ids("How do I add my study blocks to Google Calendar?")[0]).toBe("schedule");
    expect(ids("Who can see my data and can I delete my account?")[0]).toBe("privacy");
    expect(ids("Why did CatchUp send me a check-in?")[0]).toBe("checkin");
    expect(findGuideSections("anything").length).toBeLessThanOrEqual(3);
  });

  it("answers an open question with the overview", () => {
    expect(ids("What can you do?")[0]).toBe("overview");
    expect(ids("zzzz qqqq")).toEqual(["overview"]);
  });

  it("labels the tool result as the app's own guide, with section titles and places", () => {
    const text = guideToolResult(findGuideSections("How do I approve a plan?"));
    expect(text.startsWith("CATCHUP_GUIDE")).toBe(true);
    expect(text).toContain(section("approval").title);
    expect(text).toContain(section("approval").where);
    expect(text).toContain("Other guide topics:");
  });

  it("grounds statements taken from the guide, and not invented features", () => {
    const data = [guideToolResult(findGuideSections("How do I approve a plan?"))];
    expect(toolFactSupport("Routes that don't fit can't be approved.", data).supported).toBe(true);
    expect(toolFactSupport("CatchUp texts your parents whenever you skip homework.", data).supported).toBe(false);
  });
});
