import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freshStudent } from "./admin";

const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
const longDay = (iso: string, tz = "UTC") => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(iso));

async function withPlan(page: Page) {
  const course = await (await page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
  const dueAt = inDays(4);
  await page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt, estimatedMinutes: 120 } });
  const draft = await (await page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
  expect((await page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": `cal-${Date.now()}` } })).ok()).toBe(true);
  return { dueAt };
}

test("month calendar: deadlines and blocks per day, keyboard navigation, view kept in the URL, mark a block done", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const { dueAt } = await withPlan(s.page);
    await s.page.goto("/planner");
    await s.page.getByRole("group", { name: "Schedule view" }).getByRole("button", { name: "Month" }).click();
    await expect(s.page).toHaveURL(/view=month/);
    const grid = s.page.getByRole("table", { name: /Study calendar for/ });
    await expect(grid).toBeVisible();

    // Today is marked for assistive tech; the deadline day says what's on it.
    const today = grid.locator('button[aria-current="date"]');
    await expect(today).toHaveAttribute("aria-label", /^Today, /);
    const dueDay = grid.getByRole("button", { name: new RegExp(`^${longDay(dueAt)}: 1 deadline`) });
    await expect(dueDay).toBeVisible();

    // Arrow keys move the selected day; only one day is in the tab order.
    await today.focus();
    await s.page.keyboard.press("ArrowRight");
    await expect(grid.locator('button[aria-pressed="true"]')).toHaveAttribute("aria-label", new RegExp(longDay(inDays(1))));
    await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1);

    await dueDay.click();
    const detail = s.page.getByRole("region", { name: new RegExp(longDay(dueAt)) });
    await expect(detail.getByRole("list", { name: "On this day" })).toContainText("Worksheet");

    // Find the first day with a planned block and mark it done from the calendar.
    const blockDay = grid.getByRole("button", { name: /study block/ }).first();
    await blockDay.click();
    const markDone = s.page.getByRole("button", { name: /^Mark “.+” done$/ }).first();
    await markDone.click();
    await expect(s.page.getByRole("button", { name: /^Mark “.+” not done$/ }).first()).toBeVisible();

    // The view survives a reload.
    await s.page.reload();
    await expect(s.page.getByRole("table", { name: /Study calendar for/ })).toBeVisible();

    for (const scheme of ["light", "dark"] as const) {
      // Reduced motion, like the shell axe checks: fade-in animations would be measured mid-transition.
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await s.page.waitForTimeout(300);
      await expect(s.page.getByRole("table", { name: /Study calendar for/ })).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }

    await s.page.setViewportSize({ width: 320, height: 800 });
    await s.page.reload();
    const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await s.cleanup();
  }
});

test("before any plan is approved, the calendar still shows deadlines", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "History" } })).json();
    const dueAt = inDays(2);
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Essay outline", dueAt, estimatedMinutes: 60 } });
    await s.page.goto("/planner");
    await expect(s.page.getByText("No approved plan yet")).toBeVisible();
    const grid = s.page.getByRole("table", { name: /Study calendar for/ });
    await grid.getByRole("button", { name: new RegExp(`^${longDay(dueAt)}: 1 deadline`) }).click();
    await expect(s.page.getByRole("list", { name: "On this day" })).toContainText("Essay outline");
    await expect(s.page.getByRole("button", { name: /^Mark “/ })).toHaveCount(0);
  } finally {
    await s.cleanup();
  }
});

test("recovery tracker shows each assignment's progress and state; Mission Control shows the glance", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await withPlan(s.page);
    const course = await (await s.page.request.get("/api/courses")).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.courses[0].id, title: "Unplanned lab", dueAt: inDays(6), estimatedMinutes: 90 } });

    await s.page.goto("/insights");
    const tracker = s.page.getByRole("region", { name: "Recovery tracker" });
    await expect(tracker).toContainText("This week");
    const rows = tracker.getByRole("list", { name: "Assignments, most in need of attention first" });
    const unplanned = rows.getByRole("listitem").filter({ hasText: "Unplanned lab" });
    await expect(unplanned).toContainText("Not planned yet");
    await expect(unplanned.getByRole("link", { name: "Plan it" })).toHaveAttribute("href", "/recovery");
    const planned = rows.getByRole("listitem").filter({ hasText: "Worksheet" });
    await expect(planned).toContainText("On track");
    await expect(planned.getByRole("progressbar", { name: "Worksheet: 0% done" })).toBeVisible();
    // Attention first: the unplanned lab is listed before the on-track worksheet.
    await expect(rows.getByRole("listitem").first()).toContainText("Unplanned lab");

    await s.page.goto("/dashboard");
    const glance = s.page.getByRole("region", { name: "Deadline tracker" });
    await expect(glance).toContainText("1 not planned yet");
    await expect(glance).toContainText("1 on track");
  } finally {
    await s.cleanup();
  }
});
