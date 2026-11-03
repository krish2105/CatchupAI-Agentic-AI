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
    const briefing = s.page.getByLabel("Your recovery briefing");
    await expect(briefing).toContainText("1 deadline approaching");
    await expect(briefing).toContainText("Your balanced plan fits");
    await expect(briefing.getByRole("link", { name: "Build recovery plan" })).toHaveAttribute("href", "/recovery");

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

test("focus sanctuary saves a session and the API can complete a block", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "focus-e2e-1234" } });

    await s.page.goto("/focus");
    await s.page.waitForLoadState("networkidle");
    await expect(s.page.getByRole("timer")).toHaveText("25:00");
    await s.page.getByLabel("Study block").selectOption({ index: 1 });
    await s.page.getByRole("button", { name: "Start focus" }).click();
    await expect(s.page.getByRole("timer")).not.toHaveText("25:00");
    await s.page.getByRole("button", { name: "Pause" }).click();
    await s.page.getByRole("button", { name: "End and save" }).click();
    await expect(s.page.getByText(/Saved \d+ focused minute/)).toBeVisible();
    const { data: sessions } = await s.db.from("focus_sessions").select("completed").eq("owner_id", s.userId);
    expect(sessions).toEqual([{ completed: false }]);

    const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
    const res = await s.page.request.post("/api/focus-sessions", {
      data: { taskId: plan.tasks[0].id, plannedMinutes: 25, focusedMinutes: 25, startedAt: new Date(Date.now() - 26 * 60_000).toISOString(), completed: true, markTaskDone: true },
    });
    expect(res.status()).toBe(201);
    const after = await (await s.page.request.get("/api/study-tasks")).json();
    expect(after.plan.tasks[0].status).toBe("completed");
    const fake = await s.page.request.post("/api/focus-sessions", { data: { taskId: null, plannedMinutes: 25, focusedMinutes: 25, startedAt: new Date().toISOString(), completed: true } });
    expect(fake.status()).toBe(400);
  } finally {
    await s.cleanup();
  }
});

test("recovery lab shows route timelines and the exact changes before approval", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    await s.page.goto("/recovery");
    await expect(s.page.getByRole("img", { name: /^Next 7 days\./ }).first()).toBeVisible();
    await s.page.getByRole("button", { name: /Review and approve/ }).click();
    const changes = s.page.getByLabel("Exact changes before approval");
    await expect(changes).toContainText("Adds 1 study block (1h)");
    await expect(changes).toContainText("No current plan to replace");
  } finally {
    await s.cleanup();
  }
});

test("smart syllabus import proposes deadlines and saves only what the student confirms", async ({ browser }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } });
    await s.page.goto("/courses?import=syllabus");
    await s.page.waitForLoadState("networkidle");
    const dialog = s.page.getByRole("dialog", { name: /Turn a syllabus into deadlines/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Syllabus PDF").setInputFiles("tests/fixtures/syllabus.pdf");
    await dialog.getByRole("button", { name: "Find deadlines" }).click();

    const rows = s.page.getByRole("list", { name: "Detected deadlines" }).getByRole("listitem");
    await expect(rows).toHaveCount(4, { timeout: 30_000 });
    await expect(rows.first()).toContainText("p. 1");
    const before = await s.db.from("assignments").select("id").eq("owner_id", s.userId);
    expect(before.data).toEqual([]);

    await s.page.getByLabel("Include Final project report").uncheck();
    await s.page.getByLabel("Estimated hours (row 1)").fill("2");
    await s.page.getByRole("button", { name: "Add 3 deadlines" }).click();
    await expect(s.page.getByText("3 deadlines added to the course.")).toBeVisible();

    const { data } = await s.db.from("assignments").select("title, due_at, estimated_minutes").eq("owner_id", s.userId).order("due_at");
    expect(data!.map((a) => a.title)).toEqual(["Quiz 1: Regression basics", "Assignment 2 (Regression worksheet)", "Midterm exam"]);
    expect(new Date(data![0].due_at).toISOString()).toBe("2026-11-12T16:00:00.000Z");
    expect(data![0].estimated_minutes).toBe(120);
  } finally {
    await s.cleanup();
  }
});
