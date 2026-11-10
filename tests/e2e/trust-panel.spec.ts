import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminDb, freshStudent } from "./admin";
import { latestCode } from "./mail";

test("under 13 at onboarding: an answer is required, then a polite stop and the sign-in is deleted", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const email = `under13-${Date.now().toString(36)}@test.catchup.local`;
  const started = Date.now() - 1000;
  try {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: /send sign-in code/i }).click();
    await page.getByLabel("6-digit code").fill(await latestCode(email, started));
    await page.getByRole("button", { name: /verify and sign in/i }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByText("Please tell us whether you are 13 or older.")).toBeVisible();

    await page.getByLabel("I'm under 13").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/\/too-young$/);
    await expect(page.getByRole("heading", { name: "Thanks for being honest." })).toBeVisible();

    const { data } = await adminDb().auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(data.users.some((u) => u.email === email)).toBe(false);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }
});

test("public trust panel lists each control with its code and test", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto("/quality");
    const panel = page.getByRole("region", { name: "Built for UAE rules" });
    await expect(panel.getByText("Personal details removed before the AI sees them.")).toBeVisible();
    expect(await panel.getByRole("link", { name: "Code" }).count()).toBeGreaterThanOrEqual(8);
    expect(await panel.getByRole("link", { name: "Test" }).count()).toBeGreaterThanOrEqual(8);
  } finally {
    await context.close();
  }
});

test("AI-use disclosure: the page and the Markdown file list what was drafted and what the student decided", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 120 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    await s.page.request.post(`/api/proposals/${draft.proposal.id}/reject`);

    await s.page.goto("/ai-disclosure");
    await expect(s.page.getByRole("heading", { name: "Study plans drafted (1)" })).toBeVisible();
    await expect(s.page.getByText(/Dismissed by the student/)).toBeVisible();

    const file = await s.page.request.get("/api/account/ai-disclosure");
    expect(file.headers()["content-type"]).toContain("text/markdown");
    const markdown = await file.text();
    expect(markdown).toMatch(/^# AI-use disclosure/);
    expect(markdown).toContain("Dismissed by the student");

    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await expect(s.page.getByRole("heading", { name: "AI-use disclosure" })).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }
  } finally {
    await s.cleanup();
  }
});
