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

test("a pending draft shows as dotted draft blocks that can only be approved in the Recovery lab", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Chemistry" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Mole worksheet", dueAt: inDays(4), estimatedMinutes: 90 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    const first = draft.proposal.payload.tasks[0] as { startsAt: string; title: string };

    await s.page.goto("/planner");
    await expect(s.page.getByText("No approved plan yet")).toBeVisible();
    const grid = s.page.getByRole("table", { name: /Study calendar for/ });
    await grid.getByRole("button", { name: new RegExp(`^(Today, )?${longDay(first.startsAt)}: .*draft blocks? awaiting approval`) }).click();
    const items = s.page.getByRole("list", { name: "On this day" });
    await expect(items.getByRole("listitem").filter({ hasText: first.title })).toContainText("Draft, not approved");
    // No way to accept it here: no Mark done, only a link to the lab's approval dialog.
    await expect(s.page.getByRole("button", { name: /^Mark “/ })).toHaveCount(0);
    await expect(s.page.getByRole("link", { name: "Review and approve it in the Recovery lab" })).toHaveAttribute("href", `/recovery?proposal=${draft.proposal.id}`);
    await expect(s.page.getByRole("list", { name: "Legend" })).toContainText("Draft, not approved");
    // The draft is still not a plan.
    expect((await (await s.page.request.get("/api/study-tasks")).json()).plan).toBeNull();
  } finally {
    await s.cleanup();
  }
});

test("Insights: month calendar in 'done' mode with minutes per day, a table alternative, forced colours and the optional days-studied view", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await withPlan(s.page);
    const plan = (await (await s.page.request.get("/api/study-tasks")).json()).plan as { tasks: { id: string; durationMinutes: number }[] };
    const block = plan.tasks[0];
    expect((await s.page.request.patch(`/api/study-tasks/${block.id}`, { data: { status: "completed" } })).ok()).toBe(true);

    await s.page.goto("/insights");
    const cal = s.page.getByRole("region", { name: /^Study done · / });
    const grid = cal.getByRole("table", { name: /^Study done in / });
    // The done block is counted on the day it was scheduled, with its minutes printed (not colour alone).
    const doneDay = grid.getByRole("button", { name: new RegExp(`: ${block.durationMinutes} minutes of study done$`) });
    await expect(doneDay).toHaveCount(1);
    await expect(doneDay).toHaveAttribute("data-level", /[1-4]/);
    await expect(doneDay).toContainText(`${block.durationMinutes}m`);
    await expect(cal.getByRole("list", { name: "Legend" })).toContainText("2 h or more");
    await expect(cal).toContainText("each on the day it was scheduled");

    await cal.getByRole("button", { name: "Show as table" }).click();
    const table = cal.getByRole("table", { name: /^Study done per day in / });
    await expect(table.getByRole("row").nth(1)).toContainText(`${block.durationMinutes} min`);
    await expect(grid).toBeHidden();
    await cal.getByRole("button", { name: "Show as calendar" }).click();
    await expect(grid).toBeVisible();

    // Optional "X of 7 days" view: off by default, remembered in this browser.
    const toggle = s.page.getByRole("button", { name: "Show days studied this week" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(s.page.getByRole("list", { name: "The last 7 days" })).toBeHidden();
    await toggle.click();
    await expect(s.page.getByRole("list", { name: "The last 7 days" }).getByRole("listitem")).toHaveCount(7);
    await expect(s.page.getByText(/^Studied on [0-7] of the last 7 days\./)).toBeVisible();
    await s.page.reload();
    await expect(s.page.getByRole("button", { name: "Hide days studied" })).toHaveAttribute("aria-expanded", "true");
    await expect(s.page.getByText(/days in a row|streak/i)).toHaveCount(0);

    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await s.page.waitForTimeout(300);
      await expect(grid).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }

    // Windows High Contrast: backgrounds are replaced, so the selected day keeps a system-colour outline and days keep borders.
    await s.page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await s.page.reload();
    await doneDay.click();
    const styles = await doneDay.evaluate((el) => { const c = getComputedStyle(el); return { outline: c.outlineStyle, border: c.borderTopStyle }; });
    expect(styles).toEqual({ outline: "solid", border: "solid" });
    await expect(doneDay).toContainText(`${block.durationMinutes}m`);
  } finally {
    await s.cleanup();
  }
});
