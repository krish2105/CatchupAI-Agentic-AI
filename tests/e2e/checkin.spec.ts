import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser } from "@playwright/test";
import { freshStudent } from "./admin";

// Matches the fake CRON_SECRET in playwright.config.ts (test value, not a real secret).
const CRON_SECRET = "e2e-cron-secret-not-real-0123456789abcdef";
const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

/** A student with an approved plan whose first block passed unfinished, after today's check-in ran for them. */
async function slippingStudent(browser: Browser) {
  const s = await freshStudent(browser);
  const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
  await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: inDays(4), estimatedMinutes: 180 } });
  const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
  expect((await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": `checkin-${Date.now()}` } })).ok()).toBe(true);
  const { data: first } = await s.db.from("study_tasks").select("id, duration_minutes").eq("owner_id", s.userId).eq("status", "todo").order("starts_at").limit(1).single();
  const start = Date.now() - 86400_000;
  await s.db.from("study_tasks").update({ starts_at: new Date(start).toISOString(), ends_at: new Date(start + first!.duration_minutes! * 60_000).toISOString() }).eq("id", first!.id);
  // The daily job, limited to this student (the owner filter only works on a local test stack).
  const run = await s.page.request.get(`/api/cron/nudges?owner=${s.userId}`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(run.status()).toBe(200);
  expect((await run.json()).checkins).toMatchObject({ available: true, considered: 1, drafted: 1 });
  return s;
}

test("check-in card: CatchUp explains what it noticed, and Dismiss saves nothing", async ({ browser }) => {
  const s = await slippingStudent(browser);
  try {
    await s.page.goto("/dashboard");
    const card = s.page.getByRole("region", { name: "CatchUp noticed something" });
    await expect(card).toContainText(/1 block missed \(\d+ min\); Worksheet no longer fits by \d+ min/);
    await expect(card.getByRole("button", { name: "Review and approve" })).toBeEnabled();
    await expect(s.page.getByRole("heading", { name: /You missed 1 study block/ })).toHaveCount(0);

    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await s.page.waitForTimeout(300);
      await expect(s.page.getByRole("region", { name: "CatchUp noticed something" })).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }

    const plansBefore = (await s.db.from("study_plans").select("id, status").eq("owner_id", s.userId)).data;
    await s.page.getByRole("region", { name: "CatchUp noticed something" }).getByRole("button", { name: "Dismiss" }).click();
    await expect(s.page.getByRole("region", { name: "CatchUp noticed something" })).toHaveCount(0);
    const { data: drafts } = await s.db.from("action_proposals").select("status").eq("owner_id", s.userId).eq("proactive", true);
    expect(drafts?.map((d) => d.status)).toEqual(["rejected"]);
    expect((await s.db.from("study_plans").select("id, status").eq("owner_id", s.userId)).data).toEqual(plansBefore);

    // The data export says why the check-in was made.
    const exported = await (await s.page.request.get("/api/account/export")).json();
    expect(exported.checkins).toEqual([expect.objectContaining({ status: "rejected", reason: expect.stringMatching(/^1 block missed/) })]);
  } finally {
    await s.cleanup();
  }
});

test("check-in card: approving goes through the approval dialog, exactly once", async ({ browser }) => {
  const s = await slippingStudent(browser);
  try {
    await s.page.goto("/dashboard");
    await s.page.getByRole("region", { name: "CatchUp noticed something" }).getByRole("button", { name: "Review and approve" }).click();
    const dialog = s.page.getByRole("dialog");
    await expect(dialog.getByLabel("Exact changes before approval")).toBeVisible();
    await dialog.getByRole("button", { name: "Approve plan" }).dblclick();
    await s.page.waitForURL(/\/planner\?approved=1$/);
    const { data: drafts } = await s.db.from("action_proposals").select("status, applied_plan_id").eq("owner_id", s.userId).eq("proactive", true);
    expect(drafts).toHaveLength(1);
    expect(drafts![0].status).toBe("approved");
    const { data: active } = await s.db.from("study_plans").select("id").eq("owner_id", s.userId).eq("status", "active");
    expect(active?.map((p) => p.id)).toEqual([drafts![0].applied_plan_id]);
  } finally {
    await s.cleanup();
  }
});

test("check-ins are on by default and the student can turn them off", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await s.page.goto("/settings");
    const toggle = s.page.getByRole("switch", { name: "Let CatchUp check in" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect.poll(async () => (await (await s.page.request.get("/api/checkins/prefs")).json()).enabled).toBe(false);
    await s.page.reload();
    await expect(s.page.getByRole("switch", { name: "Let CatchUp check in" })).toHaveAttribute("aria-checked", "false");
  } finally {
    await s.cleanup();
  }
});
