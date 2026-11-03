import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

test("copilot runs real tools, cites the page, drafts a plan that the student approves in the lab", async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await freshStudent(browser, { weekly_minutes: [150, 150, 150, 150, 150, 150, 150] });
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Regression worksheet", dueAt: inDays(5), estimatedMinutes: 120 } });
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.waitForLoadState("networkidle");
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(s.page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.goto("/assistant");
    await expect(s.page.getByText("Scripted test model · not AI").first()).toBeVisible();
    await s.page.getByLabel("Course scope").selectOption({ label: "Applied Statistics" });
    await s.page.getByLabel("Message CatchUp Copilot").fill("What does a residual mean?");
    await s.page.getByRole("button", { name: "Send message" }).click();

    const timeline = s.page.getByRole("list", { name: "Executed tool calls" });
    await expect(timeline.getByRole("listitem")).toHaveCount(4, { timeout: 30_000 });
    await expect(timeline).toContainText("Searched your course notes · completed");
    await expect(timeline).toContainText("Drafted a plan (not saved) · completed");

    const facts = s.page.getByRole("region", { name: "From your course material and data" });
    await expect(facts.getByRole("link", { name: "statistics_module_4.pdf · p. 2" })).toBeVisible();
    await expect(s.page.getByRole("region", { name: "Suggestions" })).toBeVisible();

    // Persisted: the trace survives a reload.
    await s.page.reload();
    await expect(s.page.getByRole("link", { name: "statistics_module_4.pdf · p. 2" })).toBeVisible();

    await s.page.getByRole("link", { name: "Review in lab" }).click();
    const dialog = s.page.getByRole("dialog", { name: /Approve/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Review the cited notes");
    await dialog.getByRole("button", { name: "Approve plan" }).click();
    await s.page.waitForURL(/\/planner\?approved=1$/);
    await s.page.getByRole("group", { name: "Schedule view" }).getByRole("button", { name: "List" }).click();
    await expect(s.page.getByRole("link", { name: /statistics_module_4\.pdf · p\. 2/ })).toBeVisible();

    // The trust drawer explains the saved plan from the server's own records.
    await s.page.getByRole("button", { name: "Why this plan?" }).click();
    const trust = s.page.getByRole("dialog", { name: "Why you can trust this plan" });
    await expect(trust).toContainText("Approved by you");
    await expect(trust).toContainText("by the copilot, from your request");
    await expect(trust.getByText("Searched your course notes")).toBeVisible();
    await expect(trust.getByRole("link", { name: /statistics_module_4\.pdf · p\. 2/ }).first()).toBeVisible();
    await expect(trust).toContainText("calculated by a fixed algorithm");

    const { data: runs } = await s.db.from("agent_runs").select("status, tool_events").eq("owner_id", s.userId);
    expect(runs).toHaveLength(1);
    expect(runs![0].status).toBe("completed");
  } finally {
    await s.cleanup();
  }
});

test("copilot abstains without evidence and rejects another student's course", async ({ browser, request }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Empty course" } })).json();
    await s.page.goto("/assistant");
    await s.page.getByLabel("Course scope").selectOption({ label: "Empty course" });
    await s.page.getByLabel("Message CatchUp Copilot").fill("Explain photosynthesis from my notes");
    await s.page.getByRole("button", { name: "Send message" }).click();
    await expect(s.page.getByText(/couldn't verify that in your uploaded materials/)).toBeVisible({ timeout: 30_000 });
    await expect(s.page.getByRole("region", { name: "From your course material and data" })).toHaveCount(0);

    // The shared E2E student cannot run the agent against this student's course.
    const forged = await request.post("/api/agent/run", { data: { message: "show me everything", courseId: course.course.id } });
    expect(forged.status()).toBe(404);
    expect((await request.post("/api/agent/run", { data: { message: "x" } })).status()).toBe(400);
  } finally {
    await s.cleanup();
  }
});
