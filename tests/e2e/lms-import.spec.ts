import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

const stamp = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ics = () => Buffer.from([
  "BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:Canvas",
  "BEGIN:VEVENT", "UID:a1", `DTSTART:${stamp(5)}`, "SUMMARY:Regression worksheet [Applied Statistics]", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a2", `DTSTART:${stamp(8)}`, "SUMMARY:Lab report [Chemistry 101]", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a3", `DTSTART:${stamp(-3)}`, "SUMMARY:Old quiz [Chemistry 101]", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n"));

test("LMS import: read a Canvas calendar export in the browser, review, confirm, and skip duplicates next time", async ({ browser }) => {
  const s = await freshStudent(browser);
  // One file for both imports: due times are computed from the clock, so a second build would differ by seconds.
  const file = { name: "canvas.ics", mimeType: "text/calendar", buffer: ics() };
  try {
    await s.page.goto("/courses");
    await s.page.getByRole("button", { name: "Import from LMS" }).click();
    const dialog = s.page.getByRole("dialog", { name: "Import deadlines from your LMS" });
    await dialog.getByLabel("Export file").setInputFiles(file);

    const rows = s.page.getByRole("list", { name: "Imported deadlines" });
    await expect(rows.getByRole("listitem")).toHaveCount(3);
    await expect(s.page.getByText(/3 items found in canvas\.ics \(calendar export\)/)).toBeVisible();
    // Past deadlines start unticked.
    const old = rows.getByRole("listitem").filter({ has: s.page.getByLabel("Title (row 3)") });
    await expect(old).toContainText("Already past");
    await expect(old.getByRole("checkbox")).not.toBeChecked();
    await expect(s.page.getByLabel("Course (row 1)")).toHaveValue("Applied Statistics");
    // Nothing is saved before confirming.
    expect((await (await s.page.request.get("/api/assignments")).json()).assignments).toHaveLength(0);

    await s.page.emulateMedia({ reducedMotion: "reduce" });
    const axe = await new AxeBuilder({ page: s.page }).include("dialog[open]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await s.page.getByRole("button", { name: "Add 2 deadlines" }).click();
    await expect(s.page.getByText("2 deadlines added.")).toBeVisible();
    await expect(s.page.getByText(/New courses: Applied Statistics, Chemistry 101/)).toBeVisible();
    const saved = (await (await s.page.request.get("/api/assignments")).json()).assignments as { title: string; notes: string }[];
    expect(saved.map((a) => a.title).sort()).toEqual(["Lab report", "Regression worksheet"]);
    expect(saved[0].notes).toMatch(/^Imported from canvas\.ics \(event a[12]\)$/);

    // Importing the same file again: the rows already in CatchUp start unticked.
    await s.page.getByRole("button", { name: "Close" }).click();
    await s.page.reload();
    await s.page.getByRole("button", { name: "Import from LMS" }).click();
    await s.page.getByLabel("Export file").setInputFiles(file);
    await expect(rows.getByRole("listitem").filter({ hasText: "Already in CatchUp" })).toHaveCount(2);
    await expect(s.page.getByRole("button", { name: "Add 0 deadlines" })).toBeDisabled();
  } finally {
    await s.cleanup();
  }
});
