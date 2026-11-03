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
    await expect(briefing).toContainText("1 deadline in the next 7 days");
    await expect(briefing).toContainText("Your balanced plan fits");
    await expect(briefing.getByRole("link", { name: "Plan recovery" })).toHaveAttribute("href", "/recovery");

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
    // A refresh resumes the running session instead of losing it.
    await s.page.reload();
    await expect(s.page.getByText("Resumed your session from where you left off.")).toBeVisible();
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

test("privacy: export contains only your data, and account deletion requires typed confirmation", async ({ browser, request }) => {
  const s = await freshStudent(browser);
  let deleted = false;
  try {
    await s.page.request.post("/api/courses", { data: { title: "Mine only" } });
    const exported = await (await s.page.request.get("/api/account/export")).json();
    expect(exported.account.id).toBe(s.userId);
    expect(exported.courses.map((c: { title: string }) => c.title)).toEqual(["Mine only"]);
    const other = await (await request.get("/api/account/export")).json();
    expect(other.courses.map((c: { title: string }) => c.title)).not.toContain("Mine only");

    expect((await s.page.request.post("/api/account/delete", { data: { confirm: "delete" } })).status()).toBe(400);
    await s.page.goto("/settings");
    await s.page.getByRole("button", { name: "Delete account" }).click();
    const confirm = s.page.getByRole("dialog", { name: "Delete your account?" }).getByRole("button", { name: "Delete permanently" });
    await expect(confirm).toBeDisabled();
    await s.page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await confirm.click();
    await expect(s.page).toHaveURL(/\/$/);
    deleted = true;
    const { data } = await s.db.auth.admin.getUserById(s.userId);
    expect(data.user).toBeNull();
    const { data: rows } = await s.db.from("courses").select("id").eq("owner_id", s.userId);
    expect(rows).toEqual([]);
  } finally {
    if (!deleted) await s.cleanup();
    else await s.context.close();
  }
});

test.describe("one-click demo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a visitor can explore a seeded demo account without signing up", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Try the demo/ }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
    await expect(page.getByText("Demo account.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
    await expect(page.getByLabel("Your recovery briefing")).toContainText("deadlines in the next 7 days");
    await page.goto("/courses");
    await expect(page.getByText(/1\/1 indexed/)).toBeVisible();
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Leave the demo" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the cleanup job refuses requests without the cron secret", async ({ request }) => {
    expect((await request.get("/api/cron/cleanup-demo")).status()).toBe(403);
    expect((await request.get("/api/cron/cleanup-demo", { headers: { authorization: "Bearer wrong" } })).status()).toBe(403);
  });
});

test("smart replanner counts completed blocks and offers a replan after a missed session", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Long essay", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 180 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    expect((await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "replan-e2e-0001" } })).ok()).toBeTruthy();

    const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
    const [first, second] = plan.tasks as { id: string; durationMinutes: number }[];
    expect((await s.page.request.patch(`/api/study-tasks/${first.id}`, { data: { status: "completed" } })).ok()).toBeTruthy();

    // Completed time is no longer required.
    const recovery = await (await s.page.request.get("/api/recovery")).json();
    const essential = recovery.plan.scenarios.find((x: { key: string }) => x.key === "essential");
    expect(essential.requiredMinutes).toBe(180 - first.durationMinutes);

    // Move the next block into the past: it is now a missed session.
    const yesterday = Date.now() - 86400_000;
    await s.db.from("study_tasks").update({ starts_at: new Date(yesterday).toISOString(), ends_at: new Date(yesterday + second.durationMinutes * 60_000).toISOString() }).eq("id", second.id);
    await s.page.goto("/dashboard");
    await expect(s.page.getByRole("heading", { name: /You missed 1 study block/ })).toBeVisible();
    await s.page.getByRole("link", { name: /Replan from now/ }).click();
    await expect(s.page).toHaveURL(/\/recovery\?replan=1/);
    await expect(s.page.getByText(/Replanning around 1 missed block/)).toBeVisible();
  } finally {
    await s.cleanup();
  }
});

test("teach-it-back checks an explanation against cited pages and starts a targeted retest", async ({ browser }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.waitForLoadState("networkidle");
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(s.page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.goto("/quizzes");
    await s.page.waitForLoadState("networkidle");
    await s.page.getByLabel("Topic to explain").fill("residuals");
    await s.page.getByLabel("Your explanation").fill("A residual is the observed value minus the predicted value. Large residuals mean the model fits that point poorly, and least squares makes the squared residuals as small as possible overall.");
    await s.page.getByRole("button", { name: "Check my explanation" }).click();

    const feedback = s.page.getByLabel("Teach-back feedback");
    await expect(feedback).toContainText(/% of key concepts/);
    const concepts = feedback.getByRole("list", { name: "Key concepts from your notes" });
    await expect(concepts.getByRole("link", { name: /module_4\.pdf · p\. \d/ }).first()).toBeVisible();
    await expect(s.page.getByRole("list", { name: "Recent explanations" })).toContainText("residuals");

    // This short explanation leaves concepts out, so a targeted retest on exactly those is offered.
    await feedback.getByRole("button", { name: /Practise \d missing/ }).click();
    await expect(s.page.getByText(/Review:/).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await s.cleanup();
  }
});
