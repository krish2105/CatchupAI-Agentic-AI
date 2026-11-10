import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("Guide me, don't tell me: off by default, and the switch sends the message in guide mode", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 120 } });
    await s.page.goto("/assistant");

    const toggle = s.page.getByRole("switch", { name: "Guide me, don't tell me" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    const request = s.page.waitForRequest((r) => r.url().endsWith("/api/agent/run") && r.method() === "POST");
    const input = s.page.getByLabel("Message CatchUp Copilot");
    await input.fill("What is a residual?");
    await input.press("Enter");
    expect(JSON.parse((await request).postData() ?? "{}")).toMatchObject({ message: "What is a residual?", mode: "guide" });
    await expect(s.page.locator(".chat-bubble.user")).toHaveCount(1, { timeout: 30_000 });

    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await expect(s.page.getByRole("switch", { name: "Guide me, don't tell me" })).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }
  } finally {
    await s.cleanup();
  }
});
