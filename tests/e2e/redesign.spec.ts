import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("command palette navigates and runs actions from the keyboard", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await page.getByRole("combobox", { name: "Search pages, courses and actions" }).fill("recovery lab");
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/recovery$/);

  await page.getByRole("button", { name: /Search or run a command/ }).click();
  await page.getByRole("combobox").fill("theme");
  const before = await page.locator("html").getAttribute("data-theme");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("combobox").fill("zzzz-nothing");
  await expect(page.getByText("No matches. Try a page or course name.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("mission control briefing reflects real data and missed class rescue runs the copilot once", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await s.page.goto("/dashboard");
    await expect(s.page.getByText(/Start by adding a course/)).toBeVisible();
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 90 } });
    await s.page.reload();
    await expect(s.page.getByText(/1 deadline in the next 7 days · 1h 30m of recommended work/)).toBeVisible();
    await expect(s.page.getByLabel("Your recovery plan")).toContainText("Approve a recovery route");

    await s.page.getByRole("link", { name: "Missed class rescue" }).click();
    await expect(s.page).toHaveURL(/\/assistant$/);
    await expect(s.page.getByRole("list", { name: "Executed tool calls" }).getByRole("listitem")).toHaveCount(4, { timeout: 30_000 });
    await expect(s.page.getByText("I missed my last class. Help me catch up before my next deadline without overloading my week.")).toBeVisible();
    await s.page.reload();
    const { data } = await s.db.from("agent_runs").select("id").eq("owner_id", s.userId);
    expect(data).toHaveLength(1);
  } finally {
    await s.cleanup();
  }
});
