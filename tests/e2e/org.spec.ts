import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("organisations: a teacher creates a class, students join with the code and opt in, and totals appear only from 3 sharing students", async ({ browser }) => {
  test.setTimeout(120_000);
  const teacher = await freshStudent(browser);
  const students = await Promise.all([freshStudent(browser), freshStudent(browser), freshStudent(browser)]);
  try {
    await teacher.page.goto("/settings");
    await teacher.page.getByRole("link", { name: "Organisations" }).click();
    await expect(teacher.page).toHaveURL(/\/org$/);
    await teacher.page.getByLabel("Name").fill("Stats 101");
    await teacher.page.getByRole("button", { name: "Create" }).click();
    const card = teacher.page.getByRole("region", { name: "Stats 101" });
    await expect(card).toContainText("Admin");
    const code = (await card.locator(".org-code").textContent())!.trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);

    // One student joins and opts in through the page; the others through the API.
    const [first, ...rest] = students;
    await first.page.goto("/org");
    await first.page.getByLabel("Join code").fill(code.toLowerCase());
    await first.page.getByRole("button", { name: "Join" }).click();
    const mine = first.page.getByRole("region", { name: "Stats 101" });
    await expect(mine).toContainText("Off: you're not included in any class totals.");
    await mine.getByRole("button", { name: "Share totals" }).click();
    await expect(mine.getByRole("button", { name: "Stop sharing" })).toHaveAttribute("aria-pressed", "true");
    // A student sees no join code, roster or totals.
    await expect(mine.locator(".org-code")).toHaveCount(0);
    await expect(mine.getByRole("table")).toHaveCount(0);

    for (const s of rest) {
      const joined = await (await s.page.request.post("/api/org/join", { data: { code } })).json();
      expect((await s.page.request.post(`/api/org/${joined.id}/share`, { data: { share: true } })).ok()).toBe(true);
    }
    expect((await rest[0].page.request.post("/api/org/join", { data: { code: "ZZZZZZZZZZ" } })).status()).toBe(404);

    await teacher.page.reload();
    const totals = card.getByLabel("Class totals, last 7 days");
    await expect(totals).toContainText("3share totals");
    await expect(totals).toContainText("deadlines in the next 7 days");
    await expect(card.getByRole("table", { name: "Members of Stats 101" }).getByRole("row")).toHaveCount(5);

    // One student stops sharing: below 3, the totals disappear.
    await mine.getByRole("button", { name: "Stop sharing" }).click();
    await expect(mine.getByRole("button", { name: "Share totals" })).toBeVisible();
    await teacher.page.reload();
    await expect(card).toContainText("Class totals appear once at least 3 students share them (now 2)");

    for (const scheme of ["light", "dark"] as const) {
      await teacher.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await teacher.page.reload();
      await teacher.page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page: teacher.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }
  } finally {
    await Promise.all([teacher, ...students].map((s) => s.cleanup()));
  }
});
